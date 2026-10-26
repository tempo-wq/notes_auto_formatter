import { it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { history, undo, redo } from '@codemirror/commands';
import { highlights, applyAnalysis } from '../src/editor/editorExtension';
const candidate = { from: 0, to: 11, type: 'definition-term' as const, confidence: .95, ruleId: 'test' };
function initial() { return EditorState.create({ doc: 'Производная это предел.\nДругой абзац.', extensions: [highlights, history()] }); }
it('applies effects without changing text or selection', () => {
    let s = initial();
    const doc = s.doc.toString(), selection = s.selection;
    s = s.update({ effects: applyAnalysis.of({ revision: 0, from: 0, to: 22, items: [candidate] }) }).state;
    expect(s.doc.toString()).toBe(doc);
    expect(s.selection.eq(selection)).toBe(true);
    expect(s.field(highlights).items).toHaveLength(1);
});
it('rejects stale results after editing', () => {
    let s = initial();
    s = s.update({ changes: { from: 0, insert: 'А' } }).state;
    s = s.update({ effects: applyAnalysis.of({ revision: 0, from: 0, to: 22, items: [candidate] }) }).state;
    expect(s.field(highlights).items).toEqual([]);
});
it('removes edited highlights and maps unaffected highlights', () => {
    let s = initial();
    s = s.update({ effects: applyAnalysis.of({ revision: 0, from: 0, to: 22, items: [candidate] }) }).state;
    s = s.update({ changes: { from: s.doc.length, insert: ' текст' } }).state;
    expect(s.field(highlights).items).toEqual([candidate]);
    s = s.update({ changes: { from: 4, insert: 'а' } }).state;
    expect(s.field(highlights).items).toEqual([]);
});
it('invalidates downstream results for structural changes', () => {
    let s = initial();
    s = s.update({ effects: applyAnalysis.of({ revision: 0, from: 0, to: 22, items: [candidate] }) }).state;
    s = s.update({ changes: { from: 0, insert: '```\n' } }).state;
    expect(s.field(highlights).items).toEqual([]);
});
it('decoration effects do not create undo entries', () => {
    let state = initial();
    state = state.update({ changes: { from: state.doc.length, insert: '!' } }).state;
    const edited = state.doc.toString();
    state = state.update({ effects: applyAnalysis.of({ revision: 1, from: 0, to: 22, items: [candidate] }) }).state;
    const target = { get state() { return state; }, dispatch: (tr: any) => { state = tr.state; } };
    expect(undo(target)).toBe(true);
    expect(state.doc.toString()).toBe(initial().doc.toString());
    expect(redo(target)).toBe(true);
    expect(state.doc.toString()).toBe(edited);
});
it('isolates different editor states', () => {
    const a = initial().update({ effects: applyAnalysis.of({ revision: 0, from: 0, to: 22, items: [candidate] }) }).state;
    const b = initial();
    expect(a.field(highlights).items).toHaveLength(1);
    expect(b.field(highlights).items).toEqual([]);
});
it('invalidates when letters change an existing fence', () => {
    let state = EditorState.create({ doc: '```\nкод\n```\nПроизводная это предел', extensions: [highlights] });
    const from = state.doc.toString().indexOf('Производная');
    state = state.update({ effects: applyAnalysis.of({ revision: 0, from, to: state.doc.length, items: [{ ...candidate, from, to: from + 11 }] }) }).state;
    state = state.update({ changes: { from: 10, insert: 'abc' } }).state;
    expect(state.field(highlights).items).toEqual([]);
});
