import {build} from 'esbuild';
import {mkdir,copyFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
await mkdir(path.join(root,'dist/server'),{recursive:true});
await build({entryPoints:[path.join(root,'public/app.js')],outfile:path.join(root,'dist/client/app.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
await build({entryPoints:[path.join(root,'worker/index.js')],outfile:path.join(root,'dist/server/index.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,loader:{'.html':'text','.css':'text'},plugins:[{name:'raw-js',setup(b){b.onResolve({filter:/\?raw$/},args=>({path:path.resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}));}}]});
if(existsSync(path.join(root,'.openai/hosting.json'))){await mkdir(path.join(root,'dist/.openai'),{recursive:true});await copyFile(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));}
console.log('BUILD_OK: dist/server/index.js');
