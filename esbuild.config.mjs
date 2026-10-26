import {build} from 'esbuild';
await build({entryPoints:['src/main.ts'],bundle:true,format:'cjs',target:'es2021',outfile:'main.js',external:['obsidian','@codemirror/state','@codemirror/view','@codemirror/language','@lezer/common'],minify:true});
