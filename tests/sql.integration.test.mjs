import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sqlStore,sqlBridge} from '../src/sql-store.mjs';
import {startApp} from '../scripts/server.mjs';
test('SQL views drive real APIs and vendor workspace membership',async()=>{
  const suffix=crypto.randomUUID().slice(0,8),clientId='SQLTEST-'+suffix,matterId='001';
  const allowed='sql.allowed.'+suffix+'@am100.example',denied='sql.denied.'+suffix+'@am100.example';
  const firmStore=sqlStore('firm'),vendorStore=sqlStore('vendor');
  const firm=await startApp({role:'firm',port:0,store:firmStore,peerUrl:'#'}),vendor=await startApp({role:'vendor',port:0,store:vendorStore,firmUrl:firm.url,peerUrl:firm.url});
  async function post(app,path,data){const r=await fetch(app.url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};}
  try {
    assert.equal((await post(firm,'/api/admin',{action:'client',create:true,id:clientId,name:'SQL view integration test',active:true})).status,200);
    assert.equal((await post(firm,'/api/admin',{action:'matter',create:true,clientId,id:matterId,name:'SQL source test matter',active:true,flags:['NO_CLOUD','ITAR']})).status,200);
    for(const [i,email] of [allowed,denied].entries()) {
      assert.equal((await post(firm,'/api/admin',{action:'person',create:true,email,employeeNumber:'SQLTEST-'+suffix+'-'+i,name:'SQL Test User '+i,role:'Test',active:true})).status,200);
      assert.equal((await post(firm,'/api/admin',{action:'rule',create:true,clientId,matterId,email,effect:i?'deny':'allow',reason:'SQL source integration test'})).status,200);
    }
    await vendorStore.update(s=>s.people.push(...[allowed,denied].map(email=>({email,name:'SQL test',role:'Test',active:true}))));
    const environment={hosting:'on-premises',region:'US',aiEnabled:false,externalSharing:false};
    const created=await post(vendor,'/api/workspaces',{name:'SQL integration test '+suffix,clientId,matterId,emails:[allowed,denied],environment});
    assert.equal(created.status,201,JSON.stringify(created.data));assert.deepEqual(created.data.workspace.members,[allowed]);assert.equal(created.data.workspace.excluded[0].email,denied);
    const persisted=await vendorStore.read();assert.deepEqual(persisted.workspaces.find(w=>w.id===created.data.workspace.id).environment,environment);
    const fm=(await firmStore.read()).matters.find(m=>m.clientId===clientId);assert.deepEqual([...fm.flags].sort(),['ITAR','NO_CLOUD']);assert.ok(created.data.workspace.flags.includes('NO_CLOUD'));
    // Change an underlying table, as an admin could in SSMS; the next API read uses its view.
    const current=await sqlBridge({operation:'read',role:'firm',queries:[]});
    await sqlBridge({operation:'write',role:'firm',expectedVersion:current.version,statements:[{sql:'UPDATE dbo.FirmUsers SET IsActive=0 WHERE Email=@email',params:{email:allowed}}]});
    const walls=await post(firm,'/api/ethical-walls',{clientId,matterId,emails:[allowed]});
    assert.equal(walls.data.results[0].allowed,false);assert.equal(walls.data.results[0].reason,'Firm account is inactive');assert.equal('employeeNumber' in walls.data.results[0],false);
    const recheck=await post(vendor,'/api/workspaces/'+created.data.workspace.id+'/recheck',{});assert.equal(recheck.status,422);
    const v=await vendorStore.read();assert.equal(v.workspaces.find(w=>w.id===created.data.workspace.id).status,'suspended');
  } finally {
    await firmStore.update(s=>{s.rules=s.rules.filter(r=>r.clientId!==clientId);s.matters=s.matters.filter(m=>m.clientId!==clientId);s.clients=s.clients.filter(c=>c.id!==clientId);s.people=s.people.filter(p=>![allowed,denied].includes(p.email));});
    await vendorStore.update(s=>{s.people=s.people.filter(p=>![allowed,denied].includes(p.email));s.workspaces=s.workspaces.filter(w=>w.clientId!==clientId);});
    await Promise.all([firm,vendor].map(a=>new Promise(r=>a.server.close(r))));
  }
});
