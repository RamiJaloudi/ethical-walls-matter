import {loadOAuthConfig} from './oauth-config.mjs';
import {clientCredentials,oauthSettings} from '../src/oauth.mjs';
await loadOAuthConfig();
const config=oauthSettings();if(!config)throw Error('Configure OAuth first with npm run setup:oauth.');
const token=await clientCredentials(config)();
const endpoint='http://localhost:4313/api/client-matter-validations';
const payload={clientId:'1001',matterId:'001',environment:{hosting:'on-premises',region:'US',aiEnabled:false,externalSharing:false}};
for(const authorized of [false,true]){
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload)});
  console.log((authorized?'With token':'Without token')+': HTTP '+r.status);
  if(r.status!==(authorized?200:401))throw Error('OAuth API verification failed.');
}
const wall=await fetch('http://localhost:4313/api/ethical-walls',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({clientId:'1001',matterId:'001',emails:['alex.morgan@am100.example','jordan.lee@am100.example']})});
if(wall.status!==200)throw Error('Ethical Walls authorization failed.');
console.log('Ethical Walls with token: HTTP 200. Tokens and credentials were not printed.');
