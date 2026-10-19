import {sqlBridge} from './sql-store.mjs';
import {flagConfiguration} from './flags.mjs';
// Only SQL constants are submitted; caller payloads never become SQL text.
const queries=[['clients','api.Clients'],['matters','api.ClientMatters'],['people','api.Users'],['rules','api.EthicalWalls'],['settings','api.Settings'],['flagPolicies','api.FlagPolicies'],['matterFlags','api.MatterFlags']].map(([name,view])=>({name,sql:'SELECT * FROM '+view,params:{}}));
export function apiSqlStore(options={}) {
  async function read() {
    const {data:d}=await sqlBridge({operation:'api-read',queries},options);
    if(d.settings.length!==1)throw Error('Firm settings have not been initialized.');
    const {revision,...settings}=d.settings[0];
    return flagConfiguration({revision,settings,clients:d.clients,matters:d.matters.map(m=>({...m,flags:d.matterFlags.filter(f=>f.clientId===m.clientId&&f.matterId===m.id).map(f=>f.flag)})),people:d.people,rules:d.rules,flagPolicies:d.flagPolicies.map(p=>{const {allowedRegionsJson,...rest}=p;return {...rest,allowedRegions:JSON.parse(allowedRegionsJson)};}),logs:[]});
  }
  return {read,async update(fn){const state=await read();fn(state);for(const log of state.logs)await sqlBridge({operation:'api-audit',entry:{id:log.id,at:log.at,path:log.path,status:log.status,correlationId:log.correlationId,requestJson:JSON.stringify(log.request),responseJson:JSON.stringify(log.response)}},options);}};
}
