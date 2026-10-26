import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree, syntaxTreeAvailable, forceParsing } from '@codemirror/language';
import { analyze } from '../analysis/RuleEngine';
import { segment } from '../analysis/TextSegmenter';
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
            tr.changes.iterChanges((a, b, c, d, inserted) => {
                const oldLine = tr.startState.doc.lineAt(a);
                const oldEnd = tr.startState.doc.lineAt(b);
                dirty.push({ from: oldLine.from, to: oldEnd.to });
                // Markup edits may alter the parser's interpretation of later blocks.
                const removed = tr.startState.doc.sliceString(a, Math.min(b, a + 4096));
                structural ||= b - a > 4096 || inserted.length > 4096 || /[`~$<>\n\r*_[\]#-]/.test(removed + inserted.sliceString(0, Math.min(4096, inserted.length)) + tr.startState.doc.sliceString(oldLine.from, Math.min(oldLine.from + 128, oldLine.to)));
            });
            const items = structural ? [] : value.items.filter(c => !dirty.some(d => c.from <= d.to && c.to >= d.from)).map(c => ({ ...c, from: tr.changes.mapPos(c.from, 1), to: tr.changes.mapPos(c.to, -1) })).filter(c => c.from < c.to);
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
}
export function editorExtension(getSettings: () => Settings, getIdentity: (view: EditorView) => unknown = () => null, stats: Diagnostics = { analyzed: 0, cacheHits: 0, skippedLong: 0, skippedUnparsed: 0 }) {
    return [highlights, ViewPlugin.fromClass(class {
            decorations: DecorationSet = Decoration.none;
            timer: ReturnType<typeof setTimeout> | undefined;
            generation = 0;
            destroyed = false;
            identity: unknown;
            parsing = false;
            parseAttempts = 0;
            // Bounded per-editor content cache; coordinates stay local until application.
            cache = new Map<string, Candidate[]>();
            constructor(readonly view: EditorView) { this.identity = getIdentity(view); this.schedule(); }
            schedule(resetAttempts = true) {
                if (resetAttempts) this.parseAttempts = 0;
                clearTimeout(this.timer);
                const generation = ++this.generation;
                this.timer = setTimeout(() => this.run(generation), profiles[getSettings().profile].delay);
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
                        if (++this.parseAttempts < 8) this.schedule(false);
                        return;
                    }
                }
                const state = this.view.state, revision = state.field(highlights).revision;
                const identity = this.identity;
                const settings = getSettings(), max = profiles[settings.profile].max;
                // Lazy viewport analysis. No full-document copies or background vault scan.
                const from = state.doc.lineAt(this.view.viewport.from).from;
                const last = state.doc.lineAt(this.view.viewport.to);
                const to = last.to;
                const jobs: {
                    from: number;
                    to: number;
                }[] = [];
                for (let pos = from; pos <= to;) {
                    const line = state.doc.lineAt(pos);
                    if (line.length <= max)
                        jobs.push({ from: line.from, to: line.to });
                    else
                        stats.skippedLong++;
                    // Oversized physical lines are skipped without scanning or truncation.
                    if (line.to >= to)
                        break;
                    pos = line.to + 1;
                }
                let index = 0;
                const step = () => {
                    if (this.destroyed || generation !== this.generation || this.view.state.field(highlights).revision !== revision || getIdentity(this.view) !== identity)
                        return;
                    const job = jobs[index++];
                    if (!job)
                        return;
                    const blocked = protectedRanges(this.view.state, job.from, job.to);
                    if (blocked) {
                        const text = this.view.state.doc.sliceString(job.from, job.to);
                        const key = JSON.stringify([text, blocked, settings]);
                        let candidates = this.cache.get(key);
                        if (candidates)
                            stats.cacheHits++;
                        if (!candidates) {
                            stats.analyzed++;
                            const all: Candidate[] = [];
                            for (const s of segment(text, max))
                                for (const c of analyze(text.slice(s.from, s.to)))
                                    all.push({ ...c, from: c.from + s.from, to: c.to + s.from });
                            stats.importantCandidates = (stats.importantCandidates ?? 0) + all.filter(c => c.type === "important").length;
                            candidates = resolve(all, text.length, blocked, settings);
                            stats.importantAccepted = (stats.importantAccepted ?? 0) + candidates.filter(c => c.type === "important").length;
                            if (text.length <= max) {
                                if (this.cache.size >= 128)
                                    this.cache.delete(this.cache.keys().next().value!);
                                this.cache.set(key, candidates);
                            }
                        }
                        this.view.dispatch({ effects: apply.of({ revision, ...job, items: candidates.map(c => ({ ...c, from: c.from + job.from, to: c.to + job.from })) }) });
                    }
                    if (!blocked)
                        stats.skippedUnparsed++;
                    if (index < jobs.length)
                        this.timer = setTimeout(step, 0);
                };
                step();
            }
            update(update: ViewUpdate) {
                if (this.parsing) return;
                if (getIdentity(this.view) !== this.identity) {
                    this.identity = getIdentity(this.view);
                    this.cache.clear();
                    ++this.generation;
                    clearTimeout(this.timer);
                    this.decorations = Decoration.none;
                    this.timer = setTimeout(() => {
                        if (!this.destroyed)
                            resetAnalysis(this.view);
                    }, 0);
                    return;
                }
                if (update.docChanged || update.viewportChanged || update.geometryChanged || update.focusChanged || syntaxTree(update.startState) !== syntaxTree(update.state) || update.transactions.some(t => t.effects.some(e => e.is(reset))))
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
            destroy() { this.destroyed = true; ++this.generation; clearTimeout(this.timer); this.cache.clear(); }
        }, { decorations: p => p.decorations })];
}
export function resetAnalysis(view: EditorView) { view.dispatch({ effects: reset.of(null) }); }
