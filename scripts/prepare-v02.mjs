import {build} from 'esbuild';
await build({entryPoints:['research/v02.ts'],bundle:true,platform:'node',format:'cjs',outfile:'research/cache/v02.cjs'});
