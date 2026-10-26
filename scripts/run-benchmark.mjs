import {build} from 'esbuild';
import {unlink} from 'node:fs/promises';
await build({entryPoints:['scripts/benchmark.ts'],bundle:true,platform:'node',format:'esm',outfile:'.benchmark.mjs'});
try {await import('../.benchmark.mjs?'+Date.now());} finally {await unlink('.benchmark.mjs');}
