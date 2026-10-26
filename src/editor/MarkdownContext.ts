import { EditorState } from '@codemirror/state';
import { syntaxTree, syntaxTreeAvailable } from '@codemirror/language';
import { Span } from '../analysis/types';
/** Fail closed if the host parser has not reached this range. */
export function protectedRanges(state: EditorState, from: number, to: number): Span[] | null {
    if (!syntaxTreeAvailable(state, to))
        return null;
    const blocked: Span[] = [];
    syntaxTree(state).iterate({ from, to, enter(node) {
            if (/code|math|frontmatter|yaml|link|image|html|comment|emphasis|strong|formatting|hashtag/i.test(node.name)) {
                blocked.push({ from: Math.max(from, node.from) - from, to: Math.min(to, node.to) - from });
                return false;
            }
        } });
    // Supplemental protection for host-specific math/frontmatter nodes.
    const text = state.doc.sliceString(from, to);
    for (const m of text.matchAll(/\$\$[\s\S]*?\$\$|\$[^\n$]+\$|`+[^\n]*?`+/g))
        blocked.push({ from: m.index!, to: m.index! + m[0].length });
    if (from === 0 && /^---\s*\n/.test(text)) {
        const end = text.indexOf('\n---', 4);
        blocked.push({ from: 0, to: end < 0 ? text.length : end + 4 });
    }
    return blocked;
}
