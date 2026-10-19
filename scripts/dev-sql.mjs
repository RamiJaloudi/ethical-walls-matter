import {startApp} from './server.mjs';
import {sqlStore} from '../src/sql-store.mjs';
import {apiSqlStore} from '../src/api-sql-store.mjs';
import {oauthSettings} from '../src/oauth.mjs';
import {loadOAuthConfig} from './oauth-config.mjs';
await loadOAuthConfig();
const oauth=oauthSettings();
const firmStore=sqlStore('firm'),vendorStore=sqlStore('vendor');
await firmStore.read();await vendorStore.read();
// Set AM100_EXTERNAL_API=true when running scripts/api.mjs under a separate Windows identity.
const api=oauth&&process.env.AM100_EXTERNAL_API!=='true'?await startApp({role:'firm',port:4313,store:apiSqlStore(),oauth,apiOnly:true}):null;
const apiUrl=oauth?'http://localhost:4313':undefined;
const firm=await startApp({role:'firm',port:4311,store:firmStore,peerUrl:'http://localhost:4312',oauth,apiUrl});
const vendor=await startApp({role:'vendor',port:4312,store:vendorStore,firmUrl:apiUrl||firm.url,peerUrl:'http://localhost:4311',oauth});
console.log(oauth?'OAuth enabled: API localhost:4313, Keycloak '+oauth.issuer:'Legacy loopback demo: OAuth disabled. Use Start-OAuth.bat to configure it.');
console.log('AM100 Firm Control + APIs: http://localhost:4311\nMatterSpace Vendor: http://localhost:4312\nDatabase: '+(process.env.AM100_SQL_SERVER||'.\\SQLEXPRESS')+' / AM100IntegrationDemo\nSource: SQL views; Windows authentication');
function stop(){firm.server.close();vendor.server.close();api?.server.close();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
