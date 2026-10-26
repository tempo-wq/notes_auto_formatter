import { Candidate } from './types';
export function analyze(text: string): Candidate[] {
    const result: Candidate[] = [];
    const definition = /^\s*([\p{L}][\p{L}\p{N} ()-]{0,90}?)\s+(?:(?:[—–-]\s*)?это\s+|представляет\s+собой\s+|называется\s+)(\S[\s\S]*)/iu.exec(text);
    if (definition) {
        const term = definition[1].trim();
        if (term.split(/\s+/).length <= 7 && !/[()]/.test(term) && !/^(это|он|она|они|мы|так|как|если|когда)(?=\s|$)/iu.test(term)) {
            const from = text.indexOf(term);
            result.push({ from, to: from + term.length, type: 'definition-term', confidence: .95, ruleId: 'definition.explicit' });
        }
    }
    for (const [type, pattern] of [
        ['important', /^\s*(?:Важно|Следует помнить|Необходимо учитывать|Обратите внимание|Ключевое свойство)(?=[\s:,.!—-])/iu],
        ['example', /^\s*(?:Например|Рассмотрим пример|В качестве примера)(?=[\s:,.—-])/iu]
    ] as const) {
        const m = pattern.exec(text);
        if (m && text.slice(m[0].length).replace(/^[\s:,.!—-]+/, '').length > 2) {
            const from = text.search(/\S/);
            result.push({ from, to: text.trimEnd().length, type, confidence: .95, ruleId: type + '.marker' });
        }
    }
    // Explicit naming only; no document-wide vocabulary propagation.
    const named = /термин[а-яё]*\s+[«“]([^»”\n]{2,70})[»”]/giu;
    for (const m of text.matchAll(named)) {
        const from = m.index! + m[0].indexOf(m[1]);
        result.push({ from, to: from + m[1].length, type: 'key-term', confidence: .9, ruleId: 'term.quoted' });
    }
    return result;
}
