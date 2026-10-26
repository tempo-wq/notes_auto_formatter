import {build} from 'esbuild';
await build({entryPoints:['research/baseline.ts'],bundle:true,platform:'node',format:'cjs',outfile:'research/cache/baseline.cjs'});
