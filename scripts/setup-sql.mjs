import {readFile} from 'node:fs/promises';
import {sqlStore} from '../src/sql-store.mjs';
for(const role of ['firm','vendor']) {
  let initial;try{initial=JSON.parse(await readFile(new URL('../.local-data/'+role+'.json',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const created=await sqlStore(role).initialize(initial);
  console.log(role+': '+(created?'imported local demo records into SQL Server':'existing SQL records preserved'));
}
