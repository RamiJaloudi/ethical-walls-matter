import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {startApp} from '../scripts/server.mjs';
import {clientCredentials,oauthSettings} from '../src/oauth.mjs';
let issuerServer,issuer,key,firm,vendor,proxy,tokenRequests=0,tokenRole=true;
const roles=['ClientMatter.Validate','EthicalWalls.Check'];
async function token(changes={}){
  return new SignJWT({resource_access:{'am100-api':{roles}},...changes}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('vendor-service-account').setIssuer(issuer).setAudience('am100-api').setIssuedAt().setExpirationTime('5m').sign(key.privateKey);
}
before(async()=>{
  key=await generateKeyPair('RS256');const jwk={...await exportJWK(key.publicKey),kid:'test-key',alg:'RS256',use:'sig'};
  issuerServer=http.createServer(async(req,res)=>{
    if(req.url.endsWith('/certs')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[jwk]}));return;}
    let body='';for await(const chunk of req)body+=chunk;
    const form=new URLSearchParams(body);tokenRequests++;
    if(form.get('client_secret')!=='test-secret'||form.get('grant_type')!=='client_credentials'){res.writeHead(401);res.end('{}');return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({access_token:await token(tokenRole?{}:{resource_access:{}}),token_type:'Bearer',expires_in:300}));
  });
  await new Promise(r=>issuerServer.listen(0,'127.0.0.1',r));issuer='http://127.0.0.1:'+issuerServer.address().port;
  const oauth={issuer,audience:'am100-api',clientId:'matterspace-vendor',clientSecret:'test-secret'};
  firm=await startApp({role:'firm',port:0,persist:false,oauth,apiOnly:true});
  vendor=await startApp({role:'vendor',port:0,persist:false,oauth,firmUrl:firm.url});
  proxy=await startApp({role:'firm',port:0,persist:false,oauth,apiUrl:firm.url});
});
after(async()=>{for(const app of [firm,vendor,proxy])await new Promise(r=>app.server.close(r));await new Promise(r=>issuerServer.close(r));});
async function post(app,path,accessToken,payload={clientId:'1001',matterId:'001',emails:['alex.morgan@am100.example']}){
  return fetch(app.url+path,{method:'POST',headers:{'Content-Type':'application/json',...(accessToken?{Authorization:'Bearer '+accessToken}:{})},body:JSON.stringify(payload)});
}
test('missing and malformed tokens fail on all integration endpoints including batch and proxy',async()=>{
  for(const app of [firm,proxy])for(const path of ['/api/client-matter-validations','/api/client-matter-validations/batch','/api/ethical-walls']){
    const r=await post(app,path);assert.equal(r.status,401);assert.match(r.headers.get('www-authenticate'),/Bearer/);
    assert.equal((await post(app,path,'not-a-jwt')).status,401);
  }
});
test('JWT verification rejects wrong audience, issuer, expiration and signature',async()=>{
  for(const claims of [{aud:'another-api'},{iss:'https://wrong.example'},{exp:1}]){
    const jwt=await new SignJWT({sub:'vendor',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,iss:issuer,aud:'am100-api',...claims}).setProtectedHeader({alg:'RS256',kid:'test-key'}).sign(key.privateKey);
    assert.equal((await post(firm,'/api/client-matter-validations',jwt)).status,401);
  }
  const wrong=await generateKeyPair('RS256');const jwt=await new SignJWT({}).setProtectedHeader({alg:'RS256',kid:'test-key'}).sign(wrong.privateKey);
  assert.equal((await post(firm,'/api/client-matter-validations',jwt)).status,401);
});
test('each API requires its own role and API host has no admin or state endpoints',async()=>{
  const cmOnly=await token({resource_access:{'am100-api':{roles:['ClientMatter.Validate']}}});
  assert.equal((await post(firm,'/api/client-matter-validations',cmOnly)).status,200);
  assert.equal((await post(firm,'/api/ethical-walls',cmOnly)).status,403);
  assert.equal((await post(firm,'/api/admin',await token())).status,404);
  assert.equal((await fetch(firm.url+'/api/state')).status,404);
});
test('Swagger documents Bearer authentication and exposes no client secret',async()=>{
  const text=await (await fetch(proxy.url+'/docs/ethical-walls/openapi.json')).text();const spec=JSON.parse(text);
  assert.equal(spec.components.securitySchemes.accessToken.scheme,'bearer');assert.ok(spec.paths['/api/ethical-walls'].post.security);assert.ok(spec.paths['/api/ethical-walls'].post.responses['401']);assert.equal(text.includes('test-secret'),false);
});
test('vendor gets and caches a real HTTP token, then makes two authorized API calls',async()=>{
  const before=tokenRequests;
  for(let i=0;i<2;i++){
    const r=await post(vendor,'/api/workspaces',null,{name:'OAuth test',clientId:'1001',matterId:'001',emails:['alex.morgan@am100.example','jordan.lee@am100.example']});
    assert.equal(r.status,201);const data=await r.json();assert.equal(data.trace.length,2);assert.deepEqual(data.workspace.members,['alex.morgan@am100.example']);assert.equal(data.workspace.excluded.length,1);
  }
  assert.equal(tokenRequests-before,1);
});
test('missing vendor credentials fail closed and OAuth issuer requires HTTPS outside loopback',async()=>{
  const broken=await startApp({role:'vendor',port:0,persist:false,firmUrl:firm.url,oauth:{issuer,audience:'am100-api',clientId:'vendor'}});
  try{const r=await post(broken,'/api/workspaces',null,{name:'Must fail',clientId:'1001',matterId:'001',emails:['alex.morgan@am100.example']});assert.equal(r.status,503);assert.equal((await broken.store.read()).workspaces.length,0);}finally{await new Promise(r=>broken.server.close(r));}
  assert.throws(()=>oauthSettings({AM100_OAUTH_ENABLED:'true',AM100_OAUTH_ISSUER:'http://remote.example/realm'}),/HTTPS/);
  tokenRole=false;
  const get=clientCredentials({issuer,clientId:'vendor',clientSecret:'wrong'});await assert.rejects(get,/token request failed/);
});
