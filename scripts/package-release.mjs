import {mkdir,copyFile,readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('manifest.json','utf8'));
const pkg=JSON.parse(await readFile('package.json','utf8'));
if(manifest.version!==pkg.version)throw Error('Version mismatch');
await mkdir('release/smart-notes',{recursive:true});
for(const file of ['main.js','manifest.json','styles.css'])await copyFile(file,`release/smart-notes/${file}`);
