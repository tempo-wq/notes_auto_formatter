export type HighlightType = 'definition-term' | 'important' | 'example' | 'key-term';
export interface Span {
    from: number;
    to: number;
}
/** UTF-16 offsets, half-open, relative to the input fragment. */
export interface Candidate extends Span {
    type: HighlightType;
    confidence: number;
    ruleId: string;
}
export type Profile = 'economy' | 'balanced' | 'active';
export interface Settings {
    profile: Profile;
    enabled: Record<HighlightType, boolean>;
}
export const defaults: Settings = { profile: 'balanced', enabled: { 'definition-term': true, important: true, example: true, 'key-term': true } };
export const profiles = { economy: { delay: 1200, max: 500 }, balanced: { delay: 500, max: 2000 }, active: { delay: 200, max: 4000 } };
