import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {seed,firmEmployees} from './core.mjs';
import {flagConfiguration,workspaceEnvironment} from './flags.mjs';
const bridgePath=fileURLToPath(new URL('../scripts/sql-bridge.ps1',import.meta.url));
export function sqlBridge(input,{server=process.env.AM100_SQL_SERVER||'.\\SQLEXPRESS'}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',bridgePath],{windowsHide:true,env:{...process.env,AM100_SQL_SERVER:server},stdio:['pipe','pipe','pipe']});
    let output='',error='';const timer=setTimeout(()=>{child.kill();reject(Error('SQL Server operation timed out.'));},60000);
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>error+=d);
    child.on('error',e=>{clearTimeout(timer);reject(e);});
    child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error(error.trim()||'SQL Server bridge failed.'));try{resolve(JSON.parse(output.replace(/^\uFEFF/,'')));}catch{reject(Error('Invalid response from SQL Server bridge.'));}});
    child.stdin.end(JSON.stringify(input));
  });
}
function queries(role) {
  const defs=role==='firm'?[
    ['clients','SELECT * FROM dbo.vwClients ORDER BY id'],['matters','SELECT clientId,id,name,active FROM dbo.vwClientMatters ORDER BY matterKey'],
    ['people','SELECT * FROM dbo.vwUsers ORDER BY employeeNumber'],['rules','SELECT id,clientId,matterId,email,effect,reason FROM dbo.vwEthicalWalls ORDER BY id'],['settings','SELECT * FROM dbo.vwSettings'],['flagPolicies','SELECT * FROM dbo.vwFlagPolicies ORDER BY code'],['matterFlags','SELECT * FROM dbo.vwMatterFlags']
  ]:[['people','SELECT * FROM dbo.vwVendorUsers ORDER BY email'],['workspaces','SELECT * FROM dbo.vwWorkspaces ORDER BY sortOrder'],['members','SELECT * FROM dbo.vwWorkspaceMembers ORDER BY sortOrder']];
  return [...defs.map(([name,sql])=>({name,sql,params:{}})),{name:'logs',sql:'SELECT * FROM dbo.vwAuditLog WHERE appRole=@role ORDER BY sortOrder',params:{role}}];
}
function unpack(result,role) {
  if(result.version===0)return role==='firm'?flagConfiguration(firmEmployees(seed(role))):seed(role);
  const d=result.data,logs=d.logs.map(l=>{const {appRole,sortOrder,requestJson,responseJson,...rest}=l;return {...rest,request:JSON.parse(requestJson),response:JSON.parse(responseJson)};});
  if(role==='firm'){const {revision,...settings}=d.settings[0];const flagPolicies=d.flagPolicies.length?d.flagPolicies.map(p=>{const {allowedRegionsJson,...r}=p;return {...r,allowedRegions:JSON.parse(allowedRegionsJson)};}):undefined;return flagConfiguration({revision,settings,clients:d.clients,matters:d.matters.map(m=>({...m,flags:d.matterFlags.filter(f=>f.clientId===m.clientId&&f.matterId===m.id).map(f=>f.flag)})),people:d.people,rules:d.rules,flagPolicies,logs});}
  const workspaces=d.workspaces.map(w=>{const {sortOrder,environmentJson,flagsJson,...rest}=w,ms=d.members.filter(m=>m.workspaceId===w.id),e=JSON.parse(environmentJson||'{}');return {...rest,environment:workspaceEnvironment(e.hosting?e:undefined),flags:JSON.parse(flagsJson||'[]'),requestedMembers:ms.filter(m=>m.requested).map(m=>m.email),members:ms.filter(m=>m.admitted).map(m=>m.email),excluded:ms.filter(m=>m.reason!==null).map(m=>({email:m.email,reason:m.reason}))};});
  return {revision:result.version,people:d.people,workspaces,logs};
}
function statements(state,role) {
  const commands=[];
  const run=(sql,params={})=>commands.push({sql,params});
  function insert(table,cols,values){const params=Object.fromEntries(values.map((v,i)=>['p'+i,typeof v==='boolean'?(v?1:0):v??null]));run('INSERT INTO dbo.'+table+' ('+cols.join(',')+') VALUES ('+values.map((_,i)=>'@p'+i).join(',')+')',params);}
  run('DELETE FROM dbo.AuditLog WHERE AppRole=@role',{role});
  if(role==='firm') {
    flagConfiguration(firmEmployees(state));
    for(const t of ['MatterFlags','EthicalWallRules','ClientMatters','Matters','Clients','FirmUsers','FirmSettings','FlagPolicies'])run('DELETE FROM dbo.'+t);
    insert('FirmSettings',['Id','PolicyMode','MatterApiAvailable','WallApiAvailable','PolicyRevision','EnforceMatterFlags'],[1,state.settings.mode,state.settings.matterApi,state.settings.wallApi,state.revision,state.settings.enforceMatterFlags]);
    for(const p of state.flagPolicies)insert('FlagPolicies',['FlagCode','FlagLabel','Description','BlockCloud','BlockAI','BlockExternal','AllowedRegionsJson'],[p.code,p.label,p.description,p.blockCloud,p.blockAI,p.blockExternal,JSON.stringify(p.allowedRegions)]);
    for(const c of state.clients)insert('Clients',['ClientId','ClientName','IsActive'],[c.id,c.name,c.active]);
    const matterKeys=new Map();
    state.matters.forEach((m,i)=>{const key=i+1;matterKeys.set(JSON.stringify([m.clientId,m.id]),key);insert('Matters',['MatterKey','MatterNumber','MatterName','IsActive'],[key,m.id,m.name,m.active]);insert('ClientMatters',['ClientId','MatterKey'],[m.clientId,key]);for(const code of m.flags)insert('MatterFlags',['ClientId','MatterKey','FlagCode'],[m.clientId,key,code]);});
    for(const p of state.people)insert('FirmUsers',['Email','EmployeeNumber','FullName','JobRole','IsActive'],[p.email,p.employeeNumber,p.name,p.role,p.active]);
    for(const r of state.rules)insert('EthicalWallRules',['RuleId','ClientId','MatterKey','Email','Decision','Reason'],[r.id,r.clientId,matterKeys.get(JSON.stringify([r.clientId,r.matterId])),r.email,r.effect,r.reason]);
  } else {
    for(const t of ['WorkspaceMembers','Workspaces','VendorUsers'])run('DELETE FROM dbo.'+t);
    for(const p of state.people)insert('VendorUsers',['Email','FullName','JobRole','IsActive'],[p.email,p.name,p.role,p.active]);
    state.workspaces.forEach((w,i)=>{
      insert('Workspaces',['WorkspaceId','WorkspaceName','ClientId','MatterNumber','ClientName','MatterName','PolicyMode','PolicyRevision','WorkspaceStatus','CreatedAt','CheckedAt','LastError','SortOrder','EnvironmentJson','ValidationFlagsJson'],[w.id,w.name,w.clientId,w.matterId,w.clientName,w.matterName,w.mode,w.policyRevision,w.status,w.createdAt,w.checkedAt,w.lastError,i,JSON.stringify(workspaceEnvironment(w.environment)),JSON.stringify(w.flags||[])]);
      const members=[...new Set([...w.requestedMembers,...w.members,...w.excluded.map(p=>p.email)])];
      members.forEach((email,n)=>insert('WorkspaceMembers',['WorkspaceId','Email','IsRequested','IsAdmitted','ExclusionReason','SortOrder'],[w.id,email,w.requestedMembers.includes(email),w.members.includes(email),w.excluded.find(p=>p.email===email)?.reason,n]));
    });
  }
  state.logs.forEach((l,i)=>insert('AuditLog',['EventId','AppRole','EventTime','Endpoint','HttpStatus','CorrelationId','RequestJson','ResponseJson','DurationMs','SortOrder'],[l.id,role,l.at,l.path,l.status,l.correlationId,JSON.stringify(l.request??{}),JSON.stringify(l.response??{}),l.durationMs,i]));
  return commands;
}
export function sqlStore(role,options={}) {
  async function load(){return sqlBridge({operation:'read',role,queries:queries(role)},options);}
  return {
    async read(){return unpack(await load(),role);},
    async update(fn){for(let i=0;i<5;i++){const current=await load(),state=unpack(current,role);fn(state);const result=await sqlBridge({operation:'write',role,expectedVersion:current.version,statements:statements(state,role)},options);if(!result.conflict)return;}throw Object.assign(Error('Concurrent SQL update. Retry.'),{status:409});},
    async initialize(initial){const current=await load();if(current.version!==0)return false;const state=initial||seed(role);if(role==='firm')firmEmployees(state);const result=await sqlBridge({operation:'write',role,expectedVersion:0,statements:statements(state,role)},options);return !result.conflict;}
  };
}
