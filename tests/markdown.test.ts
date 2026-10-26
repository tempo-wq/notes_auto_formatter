import { it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { protectedRanges } from '../src/editor/MarkdownContext';
import { analyze } from '../src/analysis/RuleEngine';
import { resolve } from '../src/analysis/HighlightResolver';
import { defaults } from '../src/analysis/types';
function result(text: string) { const s = EditorState.create({ doc: text, extensions: [markdown()] }); ensureSyntaxTree(s, text.length, 100); const blocked = protectedRanges(s, 0, text.length); return blocked === null ? [] : resolve(analyze(text), text.length, blocked, defaults); }
it.each(['`Производная это предел`', '```\nПроизводная это предел\n```', '$Производная это предел$', '$$\nПроизводная это предел\n$$', '---\nПроизводная это предел\n---', '[Производная это предел](https://example.com)', '**Производная** это предел'])('protects Markdown: %s', text => expect(result(text)).toEqual([]));
it('permits ordinary text', () => expect(result('Производная это предел')).toHaveLength(1));
it('fails closed without parser', () => expect(protectedRanges(EditorState.create({ doc: 'текст' }), 0, 5)).toBeNull());
it.each(['`Производная это предел`', '```\nПроизводная это предел\n```', '**Производная** это предел', '[Производная](https://example.com) это предел'])('protects actual inner candidate: %s', text => {
    const state = EditorState.create({ doc: text, extensions: [markdown()] });
    ensureSyntaxTree(state, text.length, 100);
    const from = text.indexOf('Производная');
    const blocked = protectedRanges(state, 0, text.length)!;
    expect(resolve([{ from, to: from + 11, type: 'definition-term', confidence: .95, ruleId: 'test' }], text.length, blocked, defaults)).toEqual([]);
});
