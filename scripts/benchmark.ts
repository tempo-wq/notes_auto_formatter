import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import { analyze } from '../src/analysis/RuleEngine';
import { segment } from '../src/analysis/TextSegmenter';
import { resolve } from '../src/analysis/HighlightResolver';
import { defaults } from '../src/analysis/types';
const rows: object[] = [];
function measure(name: string, text: string, runs: number) {
    const work = () => { for (const s of segment(text, 2000)) {
        const t = text.slice(s.from, s.to);
        resolve(analyze(t), t.length, [], defaults);
    } };
    for (let i = 0; i < 30; i++)
        work();
    const samples: number[] = [];
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        work();
        samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    rows.push({ name, characters: text.length, words: text.trim().split(/\s+/).length, runs, p50ms: samples[Math.floor(runs * .5)], p95ms: samples[Math.min(runs - 1, Math.floor(runs * .95))] });
}
measure('fragment-300', ('Производная это предел отношения. ').repeat(20).slice(0, 300), 1000);
measure('fragment-2000', ('Важно: сохранять исходный текст. ').repeat(100).slice(0, 2000), 1000);
const words = 'Производная это предел отношения приращений. Важно: сохранять исходный текст.'.split(/\s+/);
for (const size of [1000, 10000, 100000])
    measure('full-pass-' + size, Array.from({ length: size }, (_, i) => words[i % words.length]).join(' '), 30);
const report = { date: new Date().toISOString(), node: process.version, platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, scope: 'Synthetic rules, segmentation and resolver only; excludes Markdown parser, editor, UI and memory.', rows };
writeFileSync('BENCHMARKS.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
