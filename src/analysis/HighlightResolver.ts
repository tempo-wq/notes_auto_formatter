import { Candidate, Span, Settings } from './types';
const priority = { 'definition-term': 0, important: 1, example: 2, 'key-term': 3 };
export function resolve(items: readonly Candidate[], length: number, blocked: readonly Span[], settings: Settings): Candidate[] {
    const accepted: Candidate[] = [];
    for (const c of [...items].sort((a, b) => priority[a.type] - priority[b.type] || b.confidence - a.confidence || a.from - b.from)) {
        if (!Number.isInteger(c.from) || !Number.isInteger(c.to) || c.from < 0 || c.to > length || c.from >= c.to || c.confidence < .85 || !settings.enabled[c.type])
            continue;
        if ([...blocked, ...accepted].some(b => c.from < b.to && c.to > b.from))
            continue;
        accepted.push(c);
    }
    return accepted.sort((a, b) => a.from - b.from);
}
