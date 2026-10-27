import { afterEach, expect, it, vi } from 'vitest';
import { EditorState, TransactionSpec } from '@codemirror/state';
import { EditorView, ViewUpdate, DecorationSet } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { editorExtension, highlights, Diagnostics } from '../src/editor/editorExtension';
import { NLPManager } from '../src/analysis/NLPManager';
import { defaults, Settings } from '../src/analysis/types';
// Runs the real controller and CodeMirror state with a simulated viewport,
// without claiming to exercise browser layout or Obsidian's host parser.
function harness(text: string, options: { unparsed?: boolean; from?: number; identity?: string; to?: number; settings?: Settings; manager?: NLPManager } = {}) {
    vi.useFakeTimers();
    const stats: Diagnostics = { analyzed: 0, cacheHits: 0, skippedLong: 0, skippedUnparsed: 0 };
    let identity = options.identity ?? 'test';
    const extensions = editorExtension(() => options.settings ?? defaults, () => identity, stats, options.manager);
    let state = EditorState.create({ doc: text, extensions: [highlights, markdown()] });
    if (!options.unparsed) ensureSyntaxTree(state, state.doc.length, 100);
    let viewport = { from: options.from ?? 0, to: options.to ?? state.doc.length };
    let controller: {
        update(u: ViewUpdate): void;
        destroy(): void;
        decorations: DecorationSet;
    };
    const view = {
        get state() { return state; },
        get viewport() { return {from: Math.min(viewport.from,state.doc.length), to: Math.min(viewport.to,state.doc.length)}; },
        get visibleRanges() { return [this.viewport]; },
        composing: false,
        hasFocus: false,
        dispatch(spec: TransactionSpec) {
            const startState = state, tr = state.update(spec);
            state = tr.state;
            controller.update({ startState, state, docChanged: tr.docChanged, viewportChanged: false, transactions: [tr] } as unknown as ViewUpdate);
        }
    };
    // ViewPlugin's factory is exercised here; no DOM or private host editor access.
    controller = (extensions[1] as unknown as {
        create(v: EditorView): typeof controller;
    }).create(view as unknown as EditorView);
    return { view, controller, stats,
        move(from: number, to: number, geometryOnly = false) { viewport = {from, to}; controller.update({startState: state, state, docChanged: false, viewportChanged: !geometryOnly, geometryChanged: true, transactions: []} as unknown as ViewUpdate); },
        switchFile(next: string) { identity = next; view.dispatch({}); }
    };
}
afterEach(() => vi.useRealTimers());
it('schedules and renders both a definition and important statement', async () => {
    const h = harness('Интеграл это обобщение суммы.\n\nВажно: сохранять исходный текст.');
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.view.state.field(highlights).items.map(c => c.type)).toEqual(['definition-term', 'important']);
    const classes: string[] = [];
    h.controller.decorations.between(0, h.view.state.doc.length, (_a, _b, value) => { classes.push(value.spec.class); });
    expect(classes).toEqual(['smart-notes-definition-term', 'smart-notes-important']);
    h.controller.destroy();
});
it('does not apply a result from before rapid edits', async () => {
    const h = harness('Интеграл это обобщение суммы.');
    h.view.dispatch({ changes: { from: 9, to: 12, insert: '' } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.view.state.field(highlights).items).toEqual([]);
    h.controller.destroy();
});
it('stops all scheduled work on destruction', async () => {
    const h = harness('Интеграл это обобщение суммы.');
    h.controller.destroy();
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.stats.analyzed).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
});
it('skips oversized lines and accounts for the skip', async () => {
    const h = harness('Важно: ' + 'а'.repeat(3000));
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.stats.skippedLong).toBe(1);
    expect(h.view.state.field(highlights).items).toEqual([]);
    h.controller.destroy();
});
it('leaves no periodic analyzer work after completion', async () => {
    const h = harness('Интеграл это обобщение суммы.');
    await vi.advanceTimersByTimeAsync(1000);
    const count = h.stats.analyzed;
    await vi.advanceTimersByTimeAsync(30000);
    expect(h.stats.analyzed).toBe(count);
    expect(vi.getTimerCount()).toBe(0);
    h.controller.destroy();
});

it('opens an existing document whose Markdown tree has not reached the visible range', async () => {
    const prefix = 'Обычное пояснение.\n\n'.repeat(10000);
    const h = harness(prefix + 'Интеграл это обобщение суммы.', {unparsed:true, from:prefix.length});
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.view.state.field(highlights).items.some(c => c.from === prefix.length)).toBe(true);
    h.controller.destroy();
});
it('resumes when a previously hidden editor becomes visible without a document edit', async () => {
    const h = harness('Интеграл это обобщение суммы.');
    h.view.composing = true;
    await vi.advanceTimersByTimeAsync(1000);
    h.view.composing = false;
    h.move(0, h.view.state.doc.length, true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.view.state.field(highlights).items).toHaveLength(1);
    h.controller.destroy();
});
it.each(['', 'Обычное пояснение.'])('opens safely with no highlights: %s', async text => {
    const h = harness(text); await vi.advanceTimersByTimeAsync(1000);
    expect(h.view.state.field(highlights).items).toEqual([]); h.controller.destroy();
});
it('restores after switching a file identity and after scrolling', async () => {
    const text = 'Интеграл это сумма.\n\nПроизводная это предел.';
    const h = harness(text); await vi.advanceTimersByTimeAsync(1000);
    h.switchFile('second'); await vi.advanceTimersByTimeAsync(1000);
    expect(h.view.state.field(highlights).items).toHaveLength(2);
    h.move(text.indexOf('Производная'),text.length); await vi.advanceTimersByTimeAsync(1000);
    expect(h.controller.decorations.size).toBe(1); h.controller.destroy();
});
it('can reopen the same contents and isolate concurrent editors', async () => {
    const a=harness('Интеграл это сумма.'), b=harness('Производная это предел.');
    await vi.advanceTimersByTimeAsync(1000); a.controller.destroy();
    const reopened=harness('Интеграл это сумма.'); await vi.advanceTimersByTimeAsync(1000);
    expect(b.view.state.field(highlights).items).toHaveLength(1);
    expect(reopened.view.state.field(highlights).items).toHaveLength(1);
    b.controller.destroy(); reopened.controller.destroy();
});

it('runs advanced without requiring keyboard focus, then returns to idle', async () => {
    const h=harness('Рекурсия — определение через самого себя.');
    await vi.advanceTimersByTimeAsync(700);
    expect(h.view.state.field(highlights).items).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.view.state.field(highlights).items[0].ruleId).toMatch(/^advanced/);
    await vi.advanceTimersByTimeAsync(30000);
    expect(vi.getTimerCount()).toBe(0); h.controller.destroy();
});
it('never initializes advanced in Rules Only', async () => {
    const create=vi.fn(()=>{throw Error('must not initialize');});
    const h=harness('Рекурсия — определение через самого себя.',{settings:{...defaults,nlpMode:'rules'},manager:new NLPManager(create)});
    await vi.advanceTimersByTimeAsync(5000);
    expect(create).not.toHaveBeenCalled(); expect(h.stats.advanced ?? 0).toBe(0);
    expect(vi.getTimerCount()).toBe(0); h.controller.destroy();
});
it('rejects a delayed advanced response after editing or closing', async () => {
    let finish: (value: [])=>void = ()=>{};
    const manager=new NLPManager(()=>({initialize:async()=>{},analyze:()=>new Promise<[]>(r=>{finish=r;}),dispose:async()=>{}}));
    const h=harness('Рекурсия — определение через самого себя.',{manager});
    await vi.advanceTimersByTimeAsync(1100);
    h.view.dispatch({changes:{from:0,to:h.view.state.doc.length,insert:'Новый текст.'}});
    finish([]); await vi.advanceTimersByTimeAsync(2000);
    expect(h.view.state.field(highlights).items).toEqual([]);
    h.controller.destroy(); await manager.dispose(); finish([]);
    await vi.advanceTimersByTimeAsync(10000); expect(vi.getTimerCount()).toBe(0);
});
it('includes safe neighboring context and invalidates it when the definition changes', async () => {
    const text='Градиентный спуск — алгоритм оптимизации.\nГрадиентный спуск изменяет параметры.';
    const h=harness(text); await vi.advanceTimersByTimeAsync(2000);
    expect(h.view.state.field(highlights).items.map(c=>c.type)).toEqual(['definition-term','key-term']);
    h.view.dispatch({changes:{from:18,to:19,insert:','}});
    expect(h.view.state.field(highlights).items).toEqual([]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.view.state.field(highlights).items).toEqual([]); h.controller.destroy();
});
it('progresses beyond the visible lines within a bounded finite neighborhood', async () => {
    const text='Обычное пояснение.\n\nРекурсия — определение через самого себя.';
    const h=harness(text,{to:17}); await vi.advanceTimersByTimeAsync(3000);
    expect(h.view.state.field(highlights).items.some(c=>c.from===text.indexOf('Рекурсия'))).toBe(true);
    expect(h.controller.decorations.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0); h.controller.destroy();
});
it('does not downgrade advanced results or restart after decoration geometry updates', async () => {
    const text='Градиентный спуск — алгоритм оптимизации.\nФункция потерь определяется как мера ошибки.';
    const h=harness(text); await vi.advanceTimersByTimeAsync(2500);
    expect(h.view.state.field(highlights).items).toHaveLength(2);
    const count=h.stats.analyzed;
    h.move(0,text.length,true); await vi.advanceTimersByTimeAsync(10000);
    expect(h.view.state.field(highlights).items).toHaveLength(2);
    expect(h.stats.analyzed).toBe(count);
    expect(vi.getTimerCount()).toBe(0); h.controller.destroy();
});
it('coalesces rapid typing and a large paste without document-sized queues', async () => {
    const h=harness('Обычный текст.');
    for(let n=0;n<100;n++)h.view.dispatch({changes:{from:h.view.state.doc.length,insert:'а'}});
    h.view.dispatch({changes:{from:0,to:h.view.state.doc.length,insert:'Градиентный спуск — алгоритм оптимизации.\n'.repeat(10000)}});
    h.move(0,40);
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.stats.analyzed).toBeLessThan(300);
    expect(h.view.state.field(highlights).items.length).toBeLessThanOrEqual(2048);
    expect(vi.getTimerCount()).toBe(0); h.controller.destroy();
});
