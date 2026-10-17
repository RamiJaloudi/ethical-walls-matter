import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {render} from '../src/ui.mjs';
let savedOrigins={};
try{savedOrigins=JSON.parse(await readFile(new URL('../.local-data/hosting-origins.json',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const origins={firm:process.env.AM100_FIRM_SITE_URL||savedOrigins.firm||'http://localhost:4311',vendor:process.env.AM100_VENDOR_SITE_URL||savedOrigins.vendor||'http://localhost:4312'};
const docs=await readFile(new URL('../src/swagger.mjs',import.meta.url),'utf8');
const flags=await readFile(new URL('../src/flags.mjs',import.meta.url),'utf8');
const core=(await readFile(new URL('../src/core.mjs',import.meta.url),'utf8')).replace("import {apiDocs,openApiSpec,swaggerPage} from './swagger.mjs';",'').replace("import {flagConfiguration,normalizeFlags,workspaceEnvironment,evaluateFlags} from './flags.mjs';",'');
const swaggerAssets={};
for(const file of ['swagger-ui-bundle.js','swagger-ui.css'])swaggerAssets[file]=await readFile(new URL('../src/vendor/'+file,import.meta.url),'utf8');
for(const role of (process.argv[2]?[process.argv[2]]:['firm','vendor'])) {
  if(!['firm','vendor'].includes(role))throw Error('Build role must be firm or vendor.');
  const root=new URL('../apps/'+role+'/',import.meta.url);
  const html=render(role,origins[role==='firm'?'vendor':'firm']);
  const worker=docs+'\n'+flags+'\n'+core+'\nconst swaggerAssets='+JSON.stringify(role==='firm'?swaggerAssets:{})+';\nconst handle=createHandler('+JSON.stringify(role)+','+JSON.stringify(html)+');\nexport default {fetch(request,env){return handle(request,{...env,swaggerAssets,store:d1Store(env.DB,'+JSON.stringify(role)+')});}};\n';
  await mkdir(new URL('worker/',root),{recursive:true});
  await writeFile(new URL('worker/index.js',root),worker);
  await writeFile(new URL('package.json',root),JSON.stringify({type:'module',private:true,scripts:{build:'node scripts/build.mjs'}},null,2));
  await writeFile(new URL('.gitignore',root),'dist/\n.env*\n*.tar.gz\n');
  await mkdir(new URL('.openai/',root),{recursive:true});
  let manifest={};try{manifest=JSON.parse(await readFile(new URL('.openai/hosting.json',root),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  manifest.d1='DB';manifest.r2=null;delete manifest.static;
  await writeFile(new URL('.openai/hosting.json',root),JSON.stringify(manifest,null,2));
  await mkdir(new URL('drizzle/meta/',root),{recursive:true});
  await writeFile(new URL('drizzle/0000_state.sql',root),'CREATE TABLE `app_state` (\n  `id` text PRIMARY KEY NOT NULL,\n  `value` text NOT NULL,\n  `version` integer DEFAULT 1 NOT NULL\n);\n');
  await writeFile(new URL('drizzle/meta/_journal.json',root),JSON.stringify({version:'7',dialect:'sqlite',entries:[{idx:0,version:'6',when:1792195200000,tag:'0000_state',breakpoints:true}]},null,2));
  await mkdir(new URL('scripts/',root),{recursive:true});
  await writeFile(new URL('scripts/build.mjs',root),`import {mkdir,copyFile,cp} from 'node:fs/promises';\nawait mkdir('dist/server',{recursive:true});\nawait mkdir('dist/.openai',{recursive:true});\nawait copyFile('worker/index.js','dist/server/index.js');\nawait copyFile('.openai/hosting.json','dist/.openai/hosting.json');\nawait cp('drizzle','dist/.openai/drizzle',{recursive:true});\nconsole.log('Built Worker artifact with D1 migration');\n`);
  await mkdir(new URL('dist/server/',root),{recursive:true});
  await mkdir(new URL('dist/.openai/',root),{recursive:true});
  await writeFile(new URL('dist/server/index.js',root),worker);
  await copyFile(new URL('.openai/hosting.json',root),new URL('dist/.openai/hosting.json',root));
  const {cp}=await import('node:fs/promises');await cp(new URL('drizzle/',root),new URL('dist/.openai/drizzle/',root),{recursive:true});
  console.log('Built '+role+' app');
}
