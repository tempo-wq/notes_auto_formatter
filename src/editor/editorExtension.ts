import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree, syntaxTreeAvailable, forceParsing } from '@codemirror/language';
import { fastAnalysis, NLPManager } from '../analysis/NLPManager';
import { mask } from '../analysis/NLPEngine';
import { resolve } from '../analysis/HighlightResolver';
import { Candidate, Settings, profiles } from '../analysis/types';
import { protectedRanges } from './MarkdownContext';
interface Batch {
    revision: number;
    from: number;
    to: number;
    items: Candidate[];
}
interface Store {
    revision: number;
    items: Candidate[];
}
export const applyAnalysis = StateEffect.define<Batch>();
const apply = applyAnalysis;
const reset = StateEffect.define<null>();
export const highlights = StateField.define<Store>({
    create: () => ({ revision: 0, items: [] }),
    update(value, tr) {
        if (tr.docChanged) {
            let structural = false;
            const dirty: {
                from: number;
                to: number;
            }[] = [];
            const contextDirty: { from: number; to: number }[] = [];
            tr.changes.iterChanges((a, b, c, d, inserted) => {
                const oldLine = tr.startState.doc.lineAt(a);
                const oldEnd = tr.startState.doc.lineAt(b);
                // A neighboring line can supply context to an advanced result.
                dirty.push({ from: oldLine.from, to: oldEnd.to });
                contextDirty.push({ from: tr.startState.doc.line(Math.max(1, oldLine.number - 1)).from, to: tr.startState.doc.line(Math.min(tr.startState.doc.lines, oldEnd.number + 1)).to });
                // Markup edits may alter the parser's interpretation of later blocks.
                const removed = tr.startState.doc.sliceString(a, Math.min(b, a + 4096));
                structural ||= b - a > 4096 || inserted.length > 4096 || /[`~$<>\n\r*_[\]#-]/.test(removed + inserted.sliceString(0, Math.min(4096, inserted.length)) + tr.startState.doc.sliceString(oldLine.from, Math.min(oldLine.from + 128, oldLine.to)));
            });
            const items = structural ? [] : value.items.filter(c => !(c.ruleId === 'advanced.context-repeat' ? contextDirty : dirty).some(d => c.from <= d.to && c.to >= d.from)).map(c => ({ ...c, from: tr.changes.mapPos(c.from, 1), to: tr.changes.mapPos(c.to, -1) })).filter(c => c.from < c.to);
            value = { revision: value.revision + 1, items };
        }
        for (const effect of tr.effects) {
            if (effect.is(reset))
                value = { revision: value.revision + 1, items: [] };
            if (effect.is(apply) && effect.value.revision === value.revision) {
                const b = effect.value;
                value = { ...value, items: [...value.items.filter(c => (c.to <= b.from || c.from >= b.to) && c.from >= b.from - 20000 && c.to <= b.to + 20000), ...b.items].sort((a, b) => a.from - b.from).slice(0, 2048) };
            }
        }
        return value;
    }
});
export interface Diagnostics {
    importantCandidates?: number;
    importantAccepted?: number;
    renderedImportant?: number;
    analyzed: number;
    cacheHits: number;
    skippedLong: number;
    skippedUnparsed: number;
    advanced?: number;
    cancelled?: number;
}
export function editorExtension(getSettings: () => Settings, getIdentity: (view: EditorView) => unknown = () => null, stats: Diagnostics = { analyzed: 0, cacheHits: 0, skippedLong: 0, skippedUnparsed: 0 }, manager = new NLPManager()) {
    return [highlights, ViewPlugin.fromClass(class {
            decorations: DecorationSet = Decoration.none;
            timer: ReturnType<typeof setTimeout> | undefined;
            generation = 0;
            destroyed = false;
            identity: unknown;
            parsing = false;
            parseAttempts = 0;
            abort = new AbortController();
            // Bounded per-editor content cache; coordinates stay local until application.
            cache = new Map<string, Candidate[]>();
            constructor(readonly view: EditorView) { this.identity = getIdentity(view); this.schedule(); }
            schedule(resetAttempts = true) {
                if (resetAttempts) this.parseAttempts = 0;
                clearTimeout(this.timer);
                this.abort.abort();
                this.abort = new AbortController();
                const generation = ++this.generation;
                this.timer = setTimeout(() => this.run(generation), resetAttempts ? profiles[getSettings().profile].delay : Math.min(100, profiles[getSettings().profile].delay));
            }
            run(generation: number) {
                if (this.destroyed || generation !== this.generation)
                    return;
                if (this.view.composing)
                    return;
                // The host parser may stop before existing content is available.
                // Advance it only off the input path, with a finite retry budget.
                if (!syntaxTreeAvailable(this.view.state, this.view.viewport.to)) {
                    this.parsing = true;
                    try { forceParsing(this.view, this.view.viewport.to, 5); }
                    finally { this.parsing = false; }
                    if (!syntaxTreeAvailable(this.view.state, this.view.viewport.to)) {
                        const limit = this.view.state.doc.length > 100000 ? 32 : 8;
                        if (++this.parseAttempts < limit) this.schedule(false);
                        return;
                    }
                }
                const state = this.view.state, revision = state.field(highlights).revision;
                const identity = this.identity;
                const settings = getSettings(), max = profiles[settings.profile].max;
                // A finite neighborhood: visible lines first, then at most 128
                // nearby lines, within the existing retained-range memory budget.
                const first = state.doc.lineAt(this.view.viewport.from);
                const last = state.doc.lineAt(this.view.viewport.to);
                const jobs: { from: number; to: number; background?: boolean }[] = [];
                const add = (number: number, background = false) => {
                    const line = state.doc.line(number);
                    if (line.length <= max) jobs.push({ from: line.from, to: line.to, background });
                    else stats.skippedLong++;
                };
                for (let n = first.number; n <= Math.min(last.number, first.number + 255); n++) add(n);
                const visibleCount = jobs.length;
                if (settings.nlpMode !== 'rules') {
                    for (let distance = 1; distance <= 64; distance++) {
                        const before = first.number - distance, after = last.number + distance;
                        if (before >= 1 && state.doc.line(before).from >= first.from - 20000) add(before, true);
                        if (after <= state.doc.lines && state.doc.line(after).to <= last.to + 20000) add(after, true);
                    }
                }
                const signal = this.abort.signal;
                const current = () => !this.destroyed && !signal.aborted && generation === this.generation &&
                    this.view.state.field(highlights).revision === revision && getIdentity(this.view) === identity;
                let index = 0, advanced = false;
                const step = async () => {
                    if (!current()) return;
                    const job = jobs[index++];
                    if (!job) return;
                    const blocked = protectedRanges(state, job.from, job.to);
                    if (blocked) {
                        const text = state.doc.sliceString(job.from, job.to);
                        let context = '';
                        {
                            const line = state.doc.lineAt(job.from);
                            if (line.number > 1) {
                                const previous = state.doc.line(line.number - 1);
                                if (previous.length <= max && previous.text.trim()) {
                                    const protectedContext = protectedRanges(state, previous.from, previous.to);
                                    if (protectedContext) context = mask(previous.text, protectedContext);
                                }
                            }
                        }
                        // Context and stage are part of the key; no stale context reuse.
                        const key = JSON.stringify([text, blocked, context, settings, advanced]);
                        // Never downgrade a completed advanced result during a
                        // geometry/viewport refresh of unchanged text and context.
                        let candidates = !advanced ? this.cache.get(JSON.stringify([text, blocked, context, settings, true])) : undefined;
                        candidates ??= this.cache.get(key);
                        if (candidates) stats.cacheHits++;
                        if (!candidates) {
                            stats.analyzed++;
                            const all = fastAnalysis(text, max);
                            // Automatic waits for a sentence boundary; Advanced can
                            // inspect unfinished paragraphs after the idle delay.
                            if (advanced && (settings.nlpMode === 'advanced' || /[.!?:;]\s*$/.test(text))) {
                                stats.advanced = (stats.advanced ?? 0) + 1;
                                all.push(...await manager.advanced({ text, context, blocked, documentVersion: revision }, signal));
                            }
                            if (!current()) { stats.cancelled = (stats.cancelled ?? 0) + 1; return; }
                            stats.importantCandidates = (stats.importantCandidates ?? 0) + all.filter(c => c.type === 'important').length;
                            candidates = resolve(all, text.length, blocked, settings);
                            stats.importantAccepted = (stats.importantAccepted ?? 0) + candidates.filter(c => c.type === 'important').length;
                            if (this.cache.size >= 128) this.cache.delete(this.cache.keys().next().value!);
                            this.cache.set(key, candidates);
                        }
                        if (!current()) return;
                        const items = candidates.map(c => ({ ...c, from: c.from + job.from, to: c.to + job.from }));
                        const previous = this.view.state.field(highlights).items.filter(c => c.from < job.to && c.to > job.from);
                        if (JSON.stringify(previous) !== JSON.stringify(items))
                            this.view.dispatch({ effects: apply.of({ revision, ...job, items }) });
                    } else stats.skippedUnparsed++;
                    // A parser/focus update during dispatch may have scheduled a
                    // new generation. Do not replace its timer with an old step.
                    if (!current()) return;
                    if (!advanced && index >= visibleCount) {
                        if (settings.nlpMode === 'rules') return;
                        advanced = true;
                        index = 0;
                        // Separate idle phase; never advanced inference on the input path.
                        this.timer = setTimeout(() => { void step(); }, Math.max(400, profiles[settings.profile].delay));
                    } else if (index < jobs.length) {
                        this.timer = setTimeout(() => { void step(); }, job.background ? 8 : 0);
                    }
                };
                if (visibleCount) void step();
            }

            update(update: ViewUpdate) {
                if (this.parsing) return;
                if (getIdentity(this.view) !== this.identity) {
                    this.identity = getIdentity(this.view);
                    this.cache.clear();
                    this.abort.abort();
                    ++this.generation;
                    clearTimeout(this.timer);
                    this.decorations = Decoration.none;
                    this.timer = setTimeout(() => {
                        if (!this.destroyed)
                            resetAnalysis(this.view);
                    }, 0);
                    return;
                }
                if (update.docChanged || update.viewportChanged || (update.geometryChanged && this.decorations.size === 0) || update.focusChanged || syntaxTree(update.startState) !== syntaxTree(update.state) || update.transactions.some(t => t.effects.some(e => e.is(reset))))
                    this.schedule();
                if (update.docChanged || update.viewportChanged || update.geometryChanged || update.startState.field(highlights) !== update.state.field(highlights))
                    this.render();
            }
            render() {
                const builder = new RangeSetBuilder<Decoration>();
                stats.renderedImportant = 0;
                for (const c of this.view.state.field(highlights).items)
                    if (this.view.visibleRanges.some(r => c.from < r.to && c.to > r.from)) {
                        builder.add(c.from, c.to, Decoration.mark({ class: 'smart-notes-' + c.type }));
                        if (c.type === 'important')
                            stats.renderedImportant++;
                    }
                this.decorations = builder.finish();
            }
            destroy() { this.abort.abort(); this.destroyed = true; ++this.generation; clearTimeout(this.timer); this.cache.clear(); }
        }, { decorations: p => p.decorations })];
}
export function resetAnalysis(view: EditorView) { view.dispatch({ effects: reset.of(null) }); }
