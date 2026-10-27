import {createInterface} from 'node:readline';
import {EditorState} from '@codemirror/state';
import {markdown} from '@codemirror/lang-markdown';
import {ensureSyntaxTree} from '@codemirror/language';
import {protectedRanges} from '../src/editor/MarkdownContext';
import {NLPManager,fastAnalysis} from '../src/analysis/NLPManager';
import {mask} from '../src/analysis/NLPEngine';
import {resolve} from '../src/analysis/HighlightResolver';
import {defaults, Candidate} from '../src/analysis/types';

async function main() {
    const manager=new NLPManager();
    for await(const line of createInterface({input:process.stdin})) {
        const request=JSON.parse(line),text=request.text as string;
        const state=EditorState.create({doc:text,extensions:[markdown()]});
        ensureSyntaxTree(state,text.length,100);
        const out: Candidate[]=[];
        for(let n=1;n<=state.doc.lines;n++) {
            const l=state.doc.line(n);
            if(l.length>2000) continue;
            const blocked=protectedRanges(state,l.from,l.to);
            if(!blocked) continue;
            let context='';
            if(n>1){const prev=state.doc.line(n-1), b=prev.length<=2000?protectedRanges(state,prev.from,prev.to):null;if(b)context=mask(prev.text,b);}
            const all=fastAnalysis(l.text,2000);
            if(request.mode!=='rules' && /[.!?:;]\s*$/.test(l.text)) all.push(...await manager.advanced({text:l.text,context,blocked,documentVersion:0}));
            out.push(...resolve(all,l.length,blocked,defaults).map(c=>({...c,from:c.from+l.from,to:c.to+l.from})));
        }
        process.stdout.write(JSON.stringify(out)+'\n');
    }
    await manager.dispose();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
