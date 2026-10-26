import { Span } from './types';
/** Bounded sentence splitting. Oversized unbroken sentences are deliberately skipped. */
export function segment(text: string, max: number): Span[] {
    const out: Span[] = [];
    let start = 0;
    const add = (end: number) => {
        let from = start;
        while (from < end && /\s/.test(text[from]))
            from++;
        if (end - from <= max && end > from)
            out.push({ from, to: end });
        start = end;
    };
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') {
            add(i);
            start = i + 1;
            continue;
        }
        if (!/[.!?…]/.test(text[i]))
            continue;
        if (text[i] === '.' && /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? ''))
            continue;
        if (/[.!?…]/.test(text[i + 1] ?? ''))
            continue;
        if (i + 1 < text.length && !/\s/.test(text[i + 1]))
            continue;
        const prefix = text.slice(Math.max(start, i - 12), i + 1);
        if (/(?:т\.\s*е\.|т\.\s*д\.|т\.\s*п\.|им\.|рис\.|стр\.|г\.|т\.)$/iu.test(prefix))
            continue;
        add(i + 1);
    }
    add(text.length);
    return out;
}
