import { bench, describe } from 'vitest';
import { analyze } from '../src/analysis/RuleEngine';
import { segment } from '../src/analysis/TextSegmenter';
for (const words of [1000, 10000, 100000])
    describe(`${words} words, synthetic full pass`, () => {
        const text = 'Производная это предел отношения приращений. Важно: сохранять исходный текст. '.repeat(Math.ceil(words / 10));
        bench('segment and analyze', () => {
            for (const s of segment(text, 2000))
                analyze(text.slice(s.from, s.to));
        });
    });
