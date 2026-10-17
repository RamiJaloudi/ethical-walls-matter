// Credentials are supplied through hidden stdin, never command arguments or files.
const input=await new Promise(resolve=>{let value='';const tty=process.stdin.isTTY;if(tty){process.stdin.setRawMode(true);process.stderr.write('Ready for verification JSON on stdin (input is hidden).\n');}process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{value+=chunk;if(/[\r\n]/.test(chunk)){if(tty)process.stdin.setRawMode(false);process.stdin.pause();resolve(JSON.parse(value.trim()));}});});
async function request(role,path,data){const r=await fetch(input[role].url+path,{headers:{'OAI-Sites-Authorization':'Bearer '+input[role].token,...(data?{'Content-Type':'application/json'}:{})},...(data?{method:'POST',body:JSON.stringify(data)}:{})});const b=await r.json();if(!r.ok)throw Error(role+' '+path+': '+r.status+' '+JSON.stringify(b));return b;}
try {
  const firm=await request('firm','/api/state');const vendor=await request('vendor','/api/state');
  console.log('Hosted D1 reads succeeded: '+firm.clients.length+' clients, '+vendor.people.length+' vendor people.');
  await request('firm','/api/admin',{action:'settings',mode:'deny',matterApi:true,wallApi:true});
  const created=await request('vendor','/api/workspaces',{name:'Aster · Integration walkthrough',clientId:'1001',matterId:'001',emails:['alex.morgan@am100.example','jordan.lee@am100.example','sam.rivera@am100.example']});
  if(created.workspace.members.length!==2||created.workspace.excluded.length!==1||created.trace.length!==2)throw Error('Unexpected default-policy result');
  console.log('Hosted server-to-server calls succeeded: 2 admitted, 1 excluded; both APIs returned 200.');
  await request('firm','/api/admin',{action:'settings',mode:'allow',matterApi:true,wallApi:true});
  const checked=await request('vendor','/api/workspaces/'+created.workspace.id+'/recheck',{});
  if(checked.workspace.members.length!==1)throw Error('Allow policy did not apply');
  console.log('Hosted allow-list toggle and membership recheck succeeded: 1 admitted.');
  await request('firm','/api/admin',{action:'settings',mode:'deny',matterApi:true,wallApi:true});
  await request('vendor','/api/workspaces/'+created.workspace.id+'/recheck',{});
  console.log('Restored default deny-list policy. Sample workspace is ready.');
}catch(e){console.error(e.message);process.exitCode=1;}
