import {createInterface} from 'node:readline';
import {analyze} from '../src/analysis/RuleEngine';
import {segment} from '../src/analysis/TextSegmenter';
import {resolve} from '../src/analysis/HighlightResolver';
import {defaults} from '../src/analysis/types';
import {EditorState} from '@codemirror/state';
import {markdown} from '@codemirror/lang-markdown';
import {ensureSyntaxTree} from '@codemirror/language';
import {protectedRanges} from '../src/editor/MarkdownContext';
async function main() {
for await (const line of createInterface({input:process.stdin})) {
 const text=JSON.parse(line);const state=EditorState.create({doc:text,extensions:[markdown()]});
 ensureSyntaxTree(state,text.length,100);
 const blocked=protectedRanges(state,0,text.length);
 const out=[];
 if(blocked)for(const s of segment(text,2000))for(const c of analyze(text.slice(s.from,s.to)))out.push({...c,from:c.from+s.from,to:c.to+s.from});
 process.stdout.write(JSON.stringify(resolve(out,text.length,blocked??[{from:0,to:text.length}],defaults))+'\n');
}

}
main().catch(error=>{console.error(error);process.exitCode=1});
