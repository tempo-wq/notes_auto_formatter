import { Candidate, Span } from './types';

/** All offsets are UTF-16 [from,to), relative to request.text, never context. */
export interface NLPAnalysisRequest {
    text: string;
    context?: string;
    blocked?: readonly Span[];
    documentVersion: number;
}
export interface NLPEngine {
    initialize(): Promise<void>;
    analyze(request: NLPAnalysisRequest, signal?: AbortSignal): Promise<Candidate[]>;
    dispose(): Promise<void>;
}

/** Preserve coordinates while preventing protected text from becoming a context cue. */
export function mask(text: string, blocked: readonly Span[]): string {
    const chars = text.split('');
    for (const span of blocked)
        for (let i = Math.max(0, span.from); i < Math.min(chars.length, span.to); i++) chars[i] = ' ';
    return chars.join('');
}
