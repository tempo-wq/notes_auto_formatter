import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({entryPoints:['scripts/v02-performance.ts'],bundle:true,platform:'node',format:'cjs',outfile:'research/cache/v02-performance.cjs'});
for(const mode of ['v01','automatic']){
    const result=spawnSync(process.execPath,['research/cache/v02-performance.cjs',mode],{stdio:'inherit'});
    if(result.status!==0)process.exit(result.status??1);
}
