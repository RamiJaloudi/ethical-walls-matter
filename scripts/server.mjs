import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHandler,seed} from '../src/core.mjs';
import {render} from '../src/ui.mjs';
export async function startApp({role,port,firmUrl,peerUrl,directory=new URL('../.local-data/',import.meta.url),persist=true,store:externalStore}) {
  const file=new URL(role+'.json',directory),temp=new URL(role+'.tmp',directory);
  let state=seed(role),pending=Promise.resolve();
  if(persist&&!externalStore){await mkdir(directory,{recursive:true});try{state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}
  const store=externalStore||{async read(){await pending;return structuredClone(state);},update(fn){const run=pending.then(async()=>{const next=structuredClone(state);fn(next);if(persist){await writeFile(temp,JSON.stringify(next,null,2));await rename(temp,file);}state=next;});pending=run.catch(()=>{});return run;}};
  const handler=createHandler(role,render(role,peerUrl));
  const swaggerAssets={};
  if(role==='firm')for(const file of ['swagger-ui-bundle.js','swagger-ui.css'])swaggerAssets[file]=await readFile(new URL('../src/vendor/'+file,import.meta.url),'utf8');
  const server=http.createServer(async(req,res)=>{try{const buffers=[];let bytes=0;for await(const b of req){bytes+=b.length;if(bytes>65536){res.writeHead(413);res.end('{"error":"Request too large"}');return;}buffers.push(b);}const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(buffers)}:{})});const response=await handler(request,{store,swaggerAssets,FIRM_URL:firmUrl,FIRM_SERVICE_TOKEN:process.env.FIRM_SERVICE_TOKEN});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"Local server error"}');}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return {server,store,url:'http://127.0.0.1:'+server.address().port};
}
