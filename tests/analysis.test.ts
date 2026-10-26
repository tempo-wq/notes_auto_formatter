import { describe, it, expect } from 'vitest';
import { analyze } from '../src/analysis/RuleEngine';
import { segment } from '../src/analysis/TextSegmenter';
import { resolve } from '../src/analysis/HighlightResolver';
import { defaults } from '../src/analysis/types';
describe('Russian rules', () => {
    it.each(['Производная это предел отношения', 'Производная — это предел отношения', 'Градиентный спуск представляет собой алгоритм оптимизации'])('extracts term: %s', text => { const c = analyze(text)[0]; expect(c.type).toBe('definition-term'); expect(text.slice(c.from, c.to)).toBe(text.startsWith('Градиент') ? 'Градиентный спуск' : 'Производная'); });
    it.each(['Обычный текст без определения', 'Это важно для расчёта', 'Важно', 'Например'])('rejects: %s', text => expect(analyze(text)).toEqual([]));
    it('recognizes explicit markers', () => { expect(analyze('Важно: сохранять исходный текст.')[0].type).toBe('important'); expect(analyze('Например, производная равна нулю.')[0].type).toBe('example'); });
    it('is deterministic', () => expect(analyze('Интеграл называется первообразной')).toEqual(analyze('Интеграл называется первообразной')));
    it('protects Markdown ranges', () => { const text = 'Производная это предел'; expect(resolve(analyze(text), text.length, [{ from: 0, to: 11 }], defaults)).toEqual([]); });
    it('removes overlaps and invalid positions', () => { const a = analyze('Производная это предел')[0]; expect(resolve([a, a, { ...a, from: -1 }], 30, [], defaults)).toEqual([a]); });
    it('respects settings', () => expect(resolve(analyze('Важно: помнить правило'), 30, [], { ...defaults, enabled: { ...defaults.enabled, important: false } })).toEqual([]));
    it('handles decimals, ellipsis and unfinished text', () => { const text = 'Число 3.14. Далее... Без точки'; expect(segment(text, 2000).map(s => text.slice(s.from, s.to))).toEqual(['Число 3.14.', 'Далее...', 'Без точки']); });
    it('skips oversized input without truncation', () => expect(segment('а'.repeat(3000), 2000)).toEqual([]));
    it('preserves UTF-16 offsets', () => { const text = 'Например, 😀 пример.'; const c = analyze(text)[0]; expect(text.slice(c.from, c.to)).toBe(text); });
});
