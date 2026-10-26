import { afterEach, expect, it, vi } from 'vitest';
import { EditorState, TransactionSpec } from '@codemirror/state';
import { EditorView, ViewUpdate, DecorationSet } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { editorExtension, highlights, Diagnostics } from '../src/editor/editorExtension';
import { defaults } from '../src/analysis/types';
// Runs the real controller and CodeMirror state with a simulated viewport,
// without claiming to exercise browser layout or Obsidian's host parser.
function harness(text: string) {
    vi.useFakeTimers();
    const stats: Diagnostics = { analyzed: 0, cacheHits: 0, skippedLong: 0, skippedUnparsed: 0 };
    const extensions = editorExtension(() => defaults, () => 'test', stats);
    let state = EditorState.create({ doc: text, extensions: [highlights, markdown()] });
    ensureSyntaxTree(state, state.doc.length, 100);
    let controller: {
        update(u: ViewUpdate): void;
        destroy(): void;
        decorations: DecorationSet;
    };
    const view = {
        get state() { return state; },
        get viewport() { return { from: 0, to: state.doc.length }; },
        get visibleRanges() { return [{ from: 0, to: state.doc.length }]; },
        composing: false,
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
    return { view, controller, stats };
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
