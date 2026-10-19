import {apiDocs,openApiSpec,swaggerPage} from './swagger.mjs';
import {flagConfiguration,normalizeFlags,workspaceEnvironment,evaluateFlags} from './flags.mjs';
export const normalize = value => String(value || '').trim().toLowerCase();
const people = [
  {name:'Alex Morgan',email:'alex.morgan@am100.example',role:'Partner',active:true},
  {name:'Jordan Lee',email:'jordan.lee@am100.example',role:'Associate',active:true},
  {name:'Sam Rivera',email:'sam.rivera@am100.example',role:'Associate',active:true},
  {name:'Taylor Chen',email:'taylor.chen@am100.example',role:'Paralegal',active:true},
  {name:'Casey Brooks',email:'casey.brooks@am100.example',role:'Counsel',active:false}
];
export function seed(role) {
  return role === 'firm' ? {
    revision:1,settings:{mode:'deny',matterApi:true,wallApi:true},
    clients:[{id:'1001',name:'Aster Technologies',active:true},{id:'1002',name:'Northstar Holdings',active:true},{id:'1003',name:'Meridian Health',active:true}],
    matters:[{clientId:'1001',id:'001',name:'Series C financing',active:true},{clientId:'1001',id:'002',name:'Patent dispute',active:true},{clientId:'1002',id:'001',name:'Acquisition advisory',active:true},{clientId:'1003',id:'001',name:'Regulatory review',active:false}],
    people:structuredClone(people),rules:[{id:'wall-1',clientId:'1001',matterId:'001',email:'jordan.lee@am100.example',effect:'deny',reason:'Conflict: adverse-party representation'},{id:'wall-2',clientId:'1001',matterId:'001',email:'alex.morgan@am100.example',effect:'allow',reason:'Approved matter team'}],logs:[]
  } : {revision:1,people:[...structuredClone(people).map(p=>({...p,active:true})),{name:'Jamie Patel',email:'jamie.patel@vendor.example',role:'External collaborator',active:true}],workspaces:[],logs:[]};
}
const json = (value,status=200) => Response.json(value?.error?{...value,errorResponse:{errorTimeStamp:new Date().toISOString(),errors:[{errorCode:String(status),errorMessage:value.error}]}}:value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function firmEmployees(s) {
  const used=new Set(s.people.map(p=>normalize(p.employeeNumber)).filter(Boolean));let next=1;
  for(const p of s.people)if(!p.employeeNumber){while(used.has(normalize('EMP-'+String(next).padStart(5,'0'))))next++;p.employeeNumber='EMP-'+String(next++).padStart(5,'0');used.add(normalize(p.employeeNumber));}
  return s;
}
const fail = (message,status=400) => {throw Object.assign(new Error(message),{status});};
function validString(v,label,max=160) {if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(label+' is required (maximum '+max+' characters).');return v.trim();}
function email(v) {v=normalize(v);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)||v.length>254)fail('Enter a valid email address.');return v;}
function matterResult(s,b) {
  const c=s.clients.find(c=>c.id===b.clientId),m=s.matters.find(m=>m.id===b.matterId&&m.clientId===b.clientId);
  let reason=!c?'Client not found':!c.active?'Client is inactive':!m?'Matter does not belong to this client':!m.active?'Matter is closed':null;
  const result={valid:!reason,reason,clientId:b.clientId,matterId:b.matterId,clientName:c?.name,matterName:m?.name,clientMatterId:String(b.clientId).padStart(5,'0')+'-'+String(b.matterId).padStart(5,'0'),matterStatus:m?(m.active?'Active':'Closed'):'NotFound',aiRestrictionsFlag:m?.flags?.includes('AI_RESTRICTED')?'Y':'N',policyRevision:s.revision,...evaluateFlags(s,m,b.environment)};
  if(!result.valid)result.workspaceAllowed=false;
  return result;
}
function wallResult(s,b) {
  const matter=matterResult(s,b);
  return {mode:s.settings.mode,policyRevision:s.revision,results:b.emails.map(email=>{
    const p=s.people.find(p=>p.email===email),rules=s.rules.filter(r=>r.email===email&&r.clientId===b.clientId&&r.matterId===b.matterId);
    const deny=rules.find(r=>r.effect==='deny'),allow=rules.find(r=>r.effect==='allow');
    const reason=!matter.valid?matter.reason:!p?'Unknown to firm':!p.active?'Firm account is inactive':deny?deny.reason||'Explicit ethical wall restriction':s.settings.mode==='allow'&&!allow?'Not on the approved matter team':null;
    return {email,allowed:!reason,reason:reason|| (allow?'Explicitly approved':'Active firm user; no restriction')};
  })};
}
function audit(s,entry) {s.logs.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),...entry});s.logs=s.logs.slice(0,200);}
async function body(req) {const raw=await req.text();if(raw.length>64000)fail('Request too large',413);try{return JSON.parse(raw);}catch{fail('Invalid JSON request.');}}
export function createHandler(role,html) {
  return async function handle(req,env) {
    const url=new URL(req.url),path=url.pathname;
    try {
      if(role==='firm'&&req.method==='GET'&&path.startsWith('/docs/')) {
        const parts=path.split('/').filter(Boolean),key=parts[1];
        if(key==='assets'&&env.swaggerAssets?.[parts[2]])return new Response(env.swaggerAssets[parts[2]],{headers:{'Content-Type':parts[2].endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
        if(apiDocs[key]&&parts.length===3&&parts[2]==='openapi.json')return json(openApiSpec(key,env.oauthPublic));
        if(apiDocs[key]&&parts.length===2)return new Response(swaggerPage(key),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'"}});
        return json({error:'Not found'},404);
      }
      if(path==='/'&&req.method==='GET')return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'self'"}});
      if(path==='/favicon.ico')return new Response(null,{status:204});
      if(!path.startsWith('/api/'))return json({error:'Not found'},404);
      if(role==='firm'&&path==='/api/health'&&req.method==='GET'){
        try{const s=await env.store.read(),up=s.settings.matterApi&&s.settings.wallApi;return json({healthcheckResponse:{name:'am100-firm-api',status:up?'up':'degraded',dependencies:[{name:'database',status:'up'},{name:'client-matter-validations',status:s.settings.matterApi?'up':'down'},{name:'ethical-walls',status:s.settings.wallApi?'up':'down'}]}},up?200:503);}catch{return json({error:'Database is unavailable'},503);}
      }
      // All browser writes must originate from this app; cross-app calls are server-side.
      if(req.method!=='GET'&&req.headers.has('Origin')&&req.headers.get('Origin')!==url.origin)return json({error:'Cross-origin write rejected'},403);
      if(req.method==='POST'&&!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||''))return json({error:'Use Content-Type: application/json'},415);
      if(path==='/api/state'&&req.method==='GET'){const s=await env.store.read();return json(role==='firm'?flagConfiguration(firmEmployees(s)):s);}
      if(role==='firm') {
        if(path==='/api/client-matter-validations/batch'&&req.method==='POST'){
          const input=await body(req);if(!Array.isArray(input)||input.length<1||input.length>100)fail('Provide 1 to 100 validation requests.');
          const requests=input.map(b=>{if(!b||typeof b!=='object')fail('Each request must be an object.');return {clientId:validString(b.clientId,'Client ID'),matterId:validString(b.matterId,'Matter ID'),...(b.environment!==undefined?{environment:workspaceEnvironment(b.environment)}:{})};});
          let results;await env.store.update(s=>{if(!s.settings.matterApi)fail('Demo API is unavailable',503);results=requests.map(b=>matterResult(s,b));audit(s,{path,request:requests,response:results,status:200,correlationId:req.headers.get('X-Correlation-ID')||req.headers.get('correlationId')||crypto.randomUUID()});});return json(results);
        }
        if(path==='/api/client-matter-validations'||path==='/api/ethical-walls') {
          if(req.method!=='POST')return json({error:'Use POST'},405);
          const b=await body(req);if(!b||Array.isArray(b)||typeof b!=='object')fail('Provide a JSON object.');b.clientId=validString(b.clientId,'Client ID');b.matterId=validString(b.matterId,'Matter ID');
          if(b.environment!==undefined)b.environment=workspaceEnvironment(b.environment);
          if(path==='/api/ethical-walls') {if(!Array.isArray(b.emails)||b.emails.length>100)fail('Provide up to 100 email addresses.');b.emails=[...new Set(b.emails.map(email))];}
          let result,status=200;
          await env.store.update(s=>{
            const enabled=path.endsWith('validations')?s.settings.matterApi:s.settings.wallApi;
            result=enabled?(path.endsWith('validations')?matterResult(s,b):wallResult(s,b)):{error:'Demo API is unavailable'};status=enabled?200:503;
            audit(s,{path,request:b,response:result,status,correlationId:req.headers.get('X-Correlation-ID')||req.headers.get('correlationId')||crypto.randomUUID()});
          });return json(result,status);
        }
        if(path==='/api/admin'&&req.method==='POST') {
          const b=await body(req);
          await env.store.update(s=>{
            flagConfiguration(firmEmployees(s));
            if(b.action==='settings') {
              if(!['deny','allow'].includes(b.mode))fail('Unknown policy mode.');
              if(typeof b.matterApi!=='boolean'||typeof b.wallApi!=='boolean')fail('API availability values must be booleans.');
              s.settings={...s.settings,mode:b.mode,matterApi:b.matterApi,wallApi:b.wallApi};
            } else if(b.action==='client') {
              const item={id:validString(b.id,'Client ID',40),name:validString(b.name,'Client name'),active:b.active!==false};
              const original=b.originalId||item.id,i=s.clients.findIndex(c=>c.id===original);
              if(b.originalId&&i<0)fail('Client no longer exists.',404);
              if(s.clients.some((c,n)=>c.id===item.id&&(n!==i||b.create)))fail('Client ID already exists.',409);
              if(i<0)s.clients.push(item);else{s.clients[i]=item;if(original!==item.id){for(const m of s.matters)if(m.clientId===original)m.clientId=item.id;for(const r of s.rules)if(r.clientId===original)r.clientId=item.id;}}
            } else if(b.action==='matter') {
              if(!s.clients.some(c=>c.id===b.clientId))fail('Choose an existing client.');
              const item={clientId:b.clientId,id:validString(b.id,'Matter ID',40),name:validString(b.name,'Matter name'),active:b.active!==false};
              const originalClient=b.originalClientId||item.clientId,original=b.originalId||item.id,i=s.matters.findIndex(m=>m.clientId===originalClient&&m.id===original);
              if(b.originalId&&i<0)fail('Matter no longer exists.',404);
              item.flags=b.flags===undefined?(i<0?[]:s.matters[i].flags):normalizeFlags(b.flags);
              if(s.matters.some((m,n)=>m.clientId===item.clientId&&m.id===item.id&&(n!==i||b.create)))fail('Client–matter already exists.',409);
              if(i<0)s.matters.push(item);else{s.matters[i]=item;for(const r of s.rules)if(r.clientId===originalClient&&r.matterId===original){r.clientId=item.clientId;r.matterId=item.id;}}
            } else if(b.action==='person') {
              const item={email:email(b.email),employeeNumber:validString(b.employeeNumber,'Employee number',40),name:validString(b.name,'Name'),role:validString(b.role,'Role'),active:b.active!==false};
              const original=normalize(b.originalEmail)||item.email,i=s.people.findIndex(p=>p.email===original);
              if(b.originalEmail&&i<0)fail('Person no longer exists.',404);
              if(s.people.some((p,n)=>(p.email===item.email||normalize(p.employeeNumber)===normalize(item.employeeNumber))&&(n!==i||b.create)))fail('Email or employee number already exists.',409);
              if(i<0)s.people.push(item);else{s.people[i]=item;for(const r of s.rules)if(r.email===original)r.email=item.email;}
            } else if(b.action==='rule') {
              if(!s.matters.some(m=>m.clientId===b.clientId&&m.id===b.matterId))fail('Choose an existing client–matter.');
              if(!s.people.some(p=>p.email===normalize(b.email)))fail('Choose a known firm person.');
              if(!['allow','deny'].includes(b.effect))fail('Unknown rule effect.');
              const original=b.originalRuleId?s.rules.find(r=>r.id===b.originalRuleId):null;
              if(b.originalRuleId&&!original)fail('Rule no longer exists.',404);
              const item={id:original?.id||crypto.randomUUID(),clientId:b.clientId,matterId:b.matterId,email:email(b.email),effect:b.effect,reason:validString(b.reason,'Reason',300)};
              const i=s.rules.findIndex(r=>r.clientId===item.clientId&&r.matterId===item.matterId&&r.email===item.email);
              if(i>=0&&s.rules[i].id!==item.id&&(original||b.create))fail('An access rule already exists for this person and matter. Edit that rule.',409);
              if(original)s.rules=s.rules.filter(r=>r.id!==original.id);else if(i>=0)s.rules.splice(i,1);s.rules.push(item);
            } else if(b.action==='flag-policy') {
              const code=normalizeFlags([b.code])[0];if(!code)fail('Flag code is required.');
              if(!Array.isArray(b.allowedRegions)||b.allowedRegions.some(v=>!['US','EU','APAC','OTHER'].includes(v)))fail('Choose valid hosting regions.');
              for(const key of ['blockCloud','blockAI','blockExternal'])if(typeof b[key]!=='boolean')fail('Restriction controls must be booleans.');
              const p={code,label:validString(b.label,'Flag label',80),description:validString(b.description,'Description',300),blockCloud:b.blockCloud,blockAI:b.blockAI,blockExternal:b.blockExternal,allowedRegions:[...new Set(b.allowedRegions)]};
              const i=s.flagPolicies.findIndex(p=>p.code===code);if(i<0)s.flagPolicies.push(p);else s.flagPolicies[i]=p;
            } else if(b.action==='flag-enforcement') {if(typeof b.enabled!=='boolean')fail('Choose an enforcement value.');s.settings.enforceMatterFlags=b.enabled;}
            else if(b.action==='delete-rule') {s.rules=s.rules.filter(r=>r.id!==b.id);}
            else if(b.action==='delete-person'){s.people=s.people.filter(p=>p.email!==b.id);s.rules=s.rules.filter(r=>r.email!==b.id);}
            else if(b.action==='delete-matter'){s.matters=s.matters.filter(m=>!(m.clientId===b.clientId&&m.id===b.id));s.rules=s.rules.filter(r=>!(r.clientId===b.clientId&&r.matterId===b.id));}
            else if(b.action==='delete-client'){s.clients=s.clients.filter(c=>c.id!==b.id);s.matters=s.matters.filter(m=>m.clientId!==b.id);s.rules=s.rules.filter(r=>r.clientId!==b.id);}
            else fail('Unknown action.');
            flagConfiguration(s);s.revision++;audit(s,{path:'/api/admin',request:{action:b.action},response:{saved:true,policyRevision:s.revision},status:200,correlationId:crypto.randomUUID()});
          });return json({saved:true});
        }
      } else {
        if(path==='/api/people'&&req.method==='POST') {
          const b=await body(req),item={email:email(b.email),name:validString(b.name,'Name'),role:validString(b.role,'Role'),active:b.active!==false};
          await env.store.update(s=>{const i=s.people.findIndex(p=>p.email===item.email);if(i<0)s.people.push(item);else s.people[i]=item;s.revision++;});return json({saved:true});
        }
        if((path==='/api/workspaces'||/^\/api\/workspaces\/[^/]+\/recheck$/.test(path))&&req.method==='POST') {
          const b=await body(req),state=await env.store.read(),isRecheck=path.endsWith('/recheck');
          const previous=isRecheck?state.workspaces.find(w=>w.id===path.split('/')[3]):null;
          if(isRecheck&&!previous)fail('Workspace not found',404);
          const data=previous||b,clientId=validString(data.clientId,'Client ID',40),matterId=validString(data.matterId,'Matter ID',40),name=validString(data.name,'Workspace name');
          const environment=workspaceEnvironment(data.environment);
          const rawEmails=previous?previous.requestedMembers:b.emails;
          if(!Array.isArray(rawEmails)||!rawEmails.length||rawEmails.length>100)fail('Select between 1 and 100 members.');
          const emails=[...new Set(rawEmails.map(email))];
          if(!isRecheck&&emails.some(e=>!state.people.some(p=>p.email===e&&p.active)))fail('Select active people from the vendor directory.');
          const correlationId=crypto.randomUUID(),trace=[];
          async function call(endpoint,payload) {
            const start=Date.now();let result,status;
            try {
              const headers={'Content-Type':'application/json','X-Correlation-ID':correlationId};
              if(env.getAccessToken)headers.Authorization='Bearer '+await env.getAccessToken();
              if(env.FIRM_SERVICE_TOKEN)headers['OAI-Sites-Authorization']='Bearer '+env.FIRM_SERVICE_TOKEN;
              const r=await fetch(new URL(endpoint,env.FIRM_URL),{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(8000),redirect:'manual'});
              status=r.status;result=await r.json();
            } catch(e) {console.error('Firm API call failed',e.name,e.message,{firmUrlConfigured:!!env.FIRM_URL,serviceTokenConfigured:!!env.FIRM_SERVICE_TOKEN});status=503;result={error:'Firm API could not be reached'};}
            trace.push({path:endpoint,request:payload,response:result,status,durationMs:Date.now()-start});
            if(status!==200)throw Object.assign(new Error(result.error||'Firm API unavailable'),{status:503});return result;
          }
          let outcome,code=201;
          try {
            const validation=await call('/api/client-matter-validations',{clientId,matterId,environment});
            if(validation.valid!==true)throw Object.assign(new Error(validation.reason||'Client–matter validation failed'),{status:422});
            if(validation.workspaceAllowed!==true)throw Object.assign(new Error((validation.restrictionViolations||[]).join('; ')||'Firm did not approve this workspace environment.'),{status:422});
            const walls=await call('/api/ethical-walls',{clientId,matterId,emails});
            if(!Array.isArray(walls.results)||!['deny','allow'].includes(walls.mode)||walls.results.length!==emails.length||emails.some(e=>walls.results.filter(r=>r.email===e&&typeof r.allowed==='boolean').length!==1))throw Object.assign(new Error('Invalid ethical wall API response'),{status:503});
            if(validation.policyRevision!==walls.policyRevision)throw Object.assign(new Error('Firm policy changed during validation. Please retry.'),{status:409});
            const allowed=walls.results.filter(r=>r.allowed===true&&state.people.some(p=>p.email===r.email&&p.active)).map(r=>r.email);
            const excluded=walls.results.filter(r=>!allowed.includes(r.email)).map(r=>({email:r.email,reason:r.allowed?'Vendor account is inactive':r.reason}));
            if(!allowed.length)throw Object.assign(new Error('No eligible members remain. Workspace '+(isRecheck?'access suspended':'was not created')+'.'),{status:422,excluded});
            const workspace={id:previous?.id||crypto.randomUUID(),name,clientId,matterId,environment,flags:validation.flags||[],clientName:validation.clientName,matterName:validation.matterName,requestedMembers:emails,members:allowed,excluded,mode:walls.mode,policyRevision:walls.policyRevision,status:'active',createdAt:previous?.createdAt||new Date().toISOString(),checkedAt:new Date().toISOString()};
            await env.store.update(s=>{if(previous){const i=s.workspaces.findIndex(w=>w.id===previous.id);s.workspaces[i]=workspace;}else s.workspaces.unshift(workspace);s.revision++;});
            outcome={workspace,trace,correlationId};code=isRecheck?200:201;
          } catch(e) {
            code=e.status||503;outcome={error:e.message,excluded:e.excluded||[],trace,correlationId};
            if(previous)await env.store.update(s=>{const w=s.workspaces.find(w=>w.id===previous.id);w.members=[];w.status='suspended';w.checkedAt=new Date().toISOString();w.lastError=e.message;});
          }
          await env.store.update(s=>{for(const t of trace)audit(s,{...t,correlationId});audit(s,{path,request:{clientId,matterId,emails},response:{result:outcome.error||'Workspace '+(isRecheck?'rechecked':'created'),workspaceId:outcome.workspace?.id},status:code,correlationId});});
          return json(outcome,code);
        }
      }
      return json({error:'Not found'},404);
    } catch(e) {return json({error:e.status?e.message:'Unexpected server error'},e.status||500);}
  };
}
export function d1Store(db,role) {
  return {
    async read(){const row=await db.prepare('SELECT value FROM app_state WHERE id = ?').bind(role).first();return row?JSON.parse(row.value):seed(role);},
    async update(fn){
      for(let attempt=0;attempt<8;attempt++) {
        const row=await db.prepare('SELECT value, version FROM app_state WHERE id = ?').bind(role).first();
        const s=row?JSON.parse(row.value):seed(role);fn(s);
        const q=row?db.prepare('UPDATE app_state SET value = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(s),role,row.version):db.prepare('INSERT OR IGNORE INTO app_state (id,value,version) VALUES (?,?,1)').bind(role,JSON.stringify(s));
        const result=await q.run();if(result.meta.changes===1)return;
      }fail('Concurrent update. Please retry.',409);
    }
  };
}
