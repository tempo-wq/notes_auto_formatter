import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
import {analyze} from '../src/analysis/RuleEngine';
import {segment} from '../src/analysis/TextSegmenter';
import {resolve} from '../src/analysis/HighlightResolver';
import {defaults} from '../src/analysis/types';
import {NLPManager,fastAnalysis} from '../src/analysis/NLPManager';

async function main() {
    const mode=process.argv[2]??'automatic';
    const manager=new NLPManager();
    const rssBefore=process.memoryUsage().rss, initStart=performance.now();
    if(mode!=='v01')await manager.advanced({text:'',documentVersion:0});
    const initializeMs=performance.now()-initStart;
    let peakRss=process.memoryUsage().rss;
    const rows=[];
    const line='Градиентный спуск — алгоритм оптимизации функции потерь. Важно: сохранять исходный текст. Например, шаг уменьшается.';
    const words=line.split(/\s+/);
    for(const scenario of [{size:300,single:true}, ...[20,300,1000,10000,100000].map(size=>({size,single:false}))]) {
        const size=scenario.size;
        // Separate bounded physical lines, as in the editor. No giant-line loophole.
        const tokens=Array.from({length:size},(_,i)=>words[i%words.length]);
        const lines:string[]=[];
        for(let i=0;i<tokens.length;i+=words.length)lines.push(tokens.slice(i,i+words.length).join(' '));
        if(scenario.single)lines.splice(0,lines.length,tokens.join(' '));
        const work=async()=>{
            let count=0,previous='';
            for(const text of lines){
                const all=mode==='v01'?segment(text,2000).flatMap(s=>analyze(text.slice(s.from,s.to)).map(c=>({...c,from:c.from+s.from,to:c.to+s.from}))):fastAnalysis(text,2000);
                if(mode!=='v01')all.push(...await manager.advanced({text,context:previous,documentVersion:0}));
                count+=resolve(all,text.length,[],defaults).length;
                previous=text;
            }
            peakRss=Math.max(peakRss,process.memoryUsage().rss);
            return count;
        };
        for(let i=0;i<5;i++)await work();
        const runs=size>=10000?30:100,samples:number[]=[];
        const cpu=process.cpuUsage();let highlights=0;
        for(let i=0;i<runs;i++){const start=performance.now();highlights=await work();samples.push(performance.now()-start);}
        const cpuDelta=process.cpuUsage(cpu);
        samples.sort((a,b)=>a-b);
        rows.push({scenario:scenario.single?'single-paragraph-active-budget':'bounded-lines',words:size,characters:lines.join('\n').length,physicalLines:lines.length,runs,p50ms:samples[Math.floor(runs*.5)],p95ms:samples[Math.ceil(runs*.95)-1],cpuUserMs:cpuDelta.user/1000,cpuSystemMs:cpuDelta.system/1000,highlights,samplesMs:samples});
    }
    await manager.dispose();
    const report={date:new Date().toISOString(),mode,node:process.version,os:os.release(),arch:process.arch,cpu:os.cpus()[0]?.model,totalMemoryBytes:os.totalmem(),scope:'Synthetic bounded-line analysis+resolution, includes Promise overhead; excludes Markdown parsing, scheduler debounce, Obsidian layout and input latency. Separate process per mode. Five warmups, 30/100 samples. RSS includes Node runtime; not plugin RAM in Obsidian. Initialization is analyzer only, not plugin startup.',initializeMs,rssBefore,rssAfter:process.memoryUsage().rss,peakSampledRss:peakRss,osPeakRssKiB:process.resourceUsage().maxRSS,rows};
    writeFileSync(`research/results/v02/performance-${mode}.json`,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({...report,rows:rows.map(({samplesMs,...r})=>r)},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
