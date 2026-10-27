import { Candidate } from './types';
import { NLPEngine, NLPAnalysisRequest, mask } from './NLPEngine';
import { segment } from './TextSegmenter';

const NON_SUBJECT = /^(?:это|этот|эта|эти|он|она|они|мы|вы|я|так|как|если|когда|здесь|там|сегодня|завтра|вчера|обсудим|рассмотрим|сделаем|проверим|запомним|используем|найдём|найдем|пусть|например|важно)(?:\s|$)/iu;
const VERB = /(?:ться|тся|ется|ются|ётся|ёт|уют|ают|яют|ить|ать|ять|ешь|ете|ем|им)$/iu;
function subject(value: string): boolean {
    const words = value.split(/\s+/);
    return value.length >= 2 && value.length <= 90 && words.length <= 7 &&
        /^[\p{L}][\p{L}\p{N} -]*$/u.test(value) && !NON_SUBJECT.test(value) &&
        !words.some(w => /^(?:в|на|из|при|для|после|через|чтобы|будет|может|нужно|надо)$/iu.test(w)) &&
        // Conservative lexical guard, not a morphological parser. Do not apply to
        // nominal endings -им/-ем here (e.g. "режим", "алгоритм").
        !/(?:ться|тся|ется|ются|уют|ают|яют|ить|ать|ять)$/iu.test(words[0]);
}
export function plausibleSubject(value: string): boolean { return subject(value); }

function definitions(text: string): Candidate[] {
    const result: Candidate[] = [];
    for (const s of segment(text, 4000)) {
        const sentence = text.slice(s.from, s.to);
        const prefix = sentence.match(/^\s*(?:(?:#{1,6}|[-*+]|\d+[.)])\s+)?/)![0].length;
        const body = sentence.slice(prefix);
        const patterns = [
            /^Под\s+([\p{L}][\p{L}\p{N} -]{1,90}?)\s+(?:понимают|понимается)\s+(\S[\s\S]+)/iu,
            /^([\p{L}][\p{L}\p{N} -]{0,90}?)\s+(?:(?:[—–-]\s*)?это\s+|называется\s+|представляет\s+собой\s+|определяется\s+как\s+|является\s+разновидностью\s+)(\S[\s\S]*)/iu,
            /^([\p{L}][\p{L}\p{N} -]{0,90}?)\s+[—–]\s+(\S[\s\S]*)/u
        ];
        for (let i = 0; i < patterns.length; i++) {
            const m = patterns[i].exec(body);
            if (!m) continue;
            const term = m[1].trim(), predicate = m[2].trim();
            if (!subject(term) || predicate.replace(/[.!?]+$/, '').length < 3) break;
            const first = predicate.match(/^[\p{L}-]+/u)?.[0] ?? '';
            // A dash alone may be a contrast, a list item or conversational pause.
            if (i === 2 && (!first || NON_SUBJECT.test(first) || VERB.test(first) || /^(?:не|а|но|уже|очень|только|потом|снова|больше|меньше)(?:\s|$)/iu.test(predicate))) break;
            const from = s.from + prefix + body.indexOf(m[1]) + m[1].indexOf(term);
            result.push({ from, to: from + term.length, type: 'definition-term', confidence: .92, ruleId: 'advanced.definition.' + i });
            break;
        }
    }
    return result;
}

/** No model, filesystem, subprocess or network. Both input windows have a hard cap. */
export class AdvancedEngine implements NLPEngine {
    private disposed = false;
    async initialize(): Promise<void> {
        if (this.disposed) throw new Error('NLP engine disposed');
    }
    async analyze(request: NLPAnalysisRequest, signal?: AbortSignal): Promise<Candidate[]> {
        if (signal?.aborted || this.disposed) return [];
        if (request.text.length > 4000) return [];
        await this.initialize();
        if (signal?.aborted || this.disposed) return [];
        const text = mask(request.text, request.blocked ?? []);
        const result = definitions(text);
        const keys: Candidate[] = [];
        // Explicit enumerations carry context without guessing all nouns.
        const list = /(?:имеет\s+следующие\s+проявления|состоит\s+из|включает\s+следующие\s+(?:компоненты|элементы|этапы))\s*:\s*([^.!?\n]{3,300})/giu;
        for (const m of text.matchAll(list)) {
            const base = m.index! + m[0].indexOf(m[1]);
            for (const part of m[1].matchAll(/[^;,]+/gu)) {
                const term = part[0].trim();
                if (!subject(term) || term.split(/\s+/).length > 5) continue;
                const from = base + part.index! + part[0].indexOf(term);
                keys.push({ from, to: from + term.length, type: 'key-term', confidence: .87, ruleId: 'advanced.enumeration' });
            }
        }
        // Only repeat a multiword term anchored by a definition in nearby text.
        // Exact inflected spellings are required; no invented stemming equivalences.
        const context = (request.context ?? '').slice(-4000);
        for (const c of definitions(context)) {
            const term = context.slice(c.from, c.to);
            if (!term.includes(' ')) continue;
            const from = new RegExp(term, 'iu').exec(text)?.index ?? -1;
            if (from < 0 || /[\p{L}\p{N}]/u.test(text[from - 1] ?? '') || /[\p{L}\p{N}]/u.test(text[from + term.length] ?? '')) continue;
            keys.push({ from, to: from + term.length, type: 'key-term', confidence: .86, ruleId: 'advanced.context-repeat' });
        }
        return signal?.aborted || this.disposed ? [] : [...result, ...keys.slice(0, 3)];
    }
    async dispose(): Promise<void> { this.disposed = true; }
}
