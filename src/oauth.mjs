import {createRemoteJWKSet,jwtVerify} from 'jose';

export const integrationPaths=new Set(['/api/client-matter-validations','/api/client-matter-validations/batch','/api/ethical-walls']);
export function oauthSettings(env=process.env) {
  if(env.AM100_OAUTH_ENABLED!=='true')return null;
  const issuer=env.AM100_OAUTH_ISSUER||'http://localhost:8180/realms/ethical-walls-matter';
  const url=new URL(issuer);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('OAuth issuer requires HTTPS except on loopback.');
  return {issuer,audience:env.AM100_OAUTH_AUDIENCE||'am100-api',clientId:env.AM100_OAUTH_CLIENT_ID||'matterspace-vendor',clientSecret:env.AM100_OAUTH_CLIENT_SECRET};
}
export function tokenVerifier(config) {
  const keys=createRemoteJWKSet(new URL(config.issuer+'/protocol/openid-connect/certs'),{timeoutDuration:5000,cooldownDuration:1000});
  return async function authorize(request) {
    const required=new URL(request.url).pathname==='/api/ethical-walls'?'EthicalWalls.Check':'ClientMatter.Validate';
    const header=request.headers.get('authorization')||'';
    if(!/^Bearer \S+$/i.test(header))return denied(401,'A Bearer access token is required.');
    let claims;
    try{({payload:claims}=await jwtVerify(header.slice(7),keys,{issuer:config.issuer,audience:config.audience,algorithms:['RS256'],requiredClaims:['exp','iat','sub'],clockTolerance:5}));}
    catch{return denied(401,'The access token is invalid or expired.');}
    const roles=claims.resource_access?.[config.audience]?.roles;
    if(!Array.isArray(roles)||!roles.includes(required))return denied(403,'The access token lacks '+required+'.',required);
    return null;
  };
}
function denied(status,error,role) {
  return Response.json({error},{status,headers:{'Cache-Control':'no-store','WWW-Authenticate':status===401?'Bearer realm="am100-api"':'Bearer error="insufficient_scope", scope="'+role+'"'}});
}
export function clientCredentials(config) {
  let cached,pending;
  return async function getAccessToken() {
    if(cached&&cached.until>Date.now())return cached.token;
    if(pending)return pending;
    pending=(async()=>{
      if(!config.clientSecret)throw Error('OAuth vendor credential is missing.');
      const response=await fetch(config.issuer+'/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:config.clientId,client_secret:config.clientSecret}),signal:AbortSignal.timeout(5000),redirect:'error'});
      if(!response.ok)throw Error('OAuth token request failed ('+response.status+').');
      const data=await response.json();
      if(typeof data.access_token!=='string'||data.token_type?.toLowerCase()!=='bearer'||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('OAuth token response is invalid.');
      cached={token:data.access_token,until:Date.now()+Math.max(0,data.expires_in-30)*1000};return cached.token;
    })();
    try{return await pending;}finally{pending=null;}
  };
}
