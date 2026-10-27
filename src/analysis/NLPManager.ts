import { analyze } from './RuleEngine';
import { segment } from './TextSegmenter';
import { Candidate } from './types';
import { AdvancedEngine, plausibleSubject } from './AdvancedEngine';
import { NLPEngine, NLPAnalysisRequest, mask } from './NLPEngine';

/** v0.1 remains independently callable as the frozen benchmark baseline. */
export function fastAnalysis(text: string, max: number): Candidate[] {
    const all: Candidate[] = [];
    for (const s of segment(text, max)) {
        const fragment = text.slice(s.from, s.to);
        for (const c of analyze(fragment)) {
            if (c.type === 'definition-term' && !plausibleSubject(fragment.slice(c.from, c.to))) continue;
            all.push({ ...c, from: c.from + s.from, to: c.to + s.from });
        }
        if (/^Допустим,\s+что\s+\S.{2,}/iu.test(fragment))
            all.push({ from: s.from, to: s.to, type: 'example', confidence: .95, ruleId: 'example.suppose' });
    }
    return all;
}
export class NLPManager {
    private engine: NLPEngine | undefined;
    private ready: Promise<void> | undefined;
    private disposed = false;
    constructor(private readonly create: () => NLPEngine = () => new AdvancedEngine()) {}
    async advanced(request: NLPAnalysisRequest, signal?: AbortSignal): Promise<Candidate[]> {
        if (this.disposed || signal?.aborted) return [];
        try {
            this.engine ??= this.create();
            this.ready ??= this.engine.initialize();
            await this.ready;
            if (this.disposed || signal?.aborted) return [];
            return await this.engine.analyze({ ...request, text: mask(request.text, request.blocked ?? []) }, signal);
        } catch (error) {
            if (!signal?.aborted && !this.disposed) console.warn('Smart Notes: advanced analysis unavailable; using rules.', error);
            return [];
        }
    }
    async dispose(): Promise<void> {
        this.disposed = true;
        await this.engine?.dispose();
        this.engine = undefined;
        this.ready = undefined;
    }
}
