import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../.local-data/oauth/',import.meta.url);
await mkdir(new URL('import/',root),{recursive:true});
let config;
try{config=JSON.parse(await readFile(new URL('config.json',root),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;config={AM100_OAUTH_ENABLED:'true',AM100_OAUTH_ISSUER:'http://localhost:8180/realms/ethical-walls-matter',AM100_OAUTH_AUDIENCE:'am100-api',AM100_OAUTH_CLIENT_ID:'matterspace-vendor',AM100_OAUTH_CLIENT_SECRET:randomBytes(32).toString('hex'),KEYCLOAK_ADMIN_PASSWORD:randomBytes(24).toString('hex')};await writeFile(new URL('config.json',root),JSON.stringify(config,null,2));}
const roles=['ClientMatter.Validate','EthicalWalls.Check'];
const realm={realm:'ethical-walls-matter',enabled:true,sslRequired:'none',accessTokenLifespan:300,roles:{client:{'am100-api':roles.map(name=>({name}))}},clients:[
  {clientId:'am100-api',enabled:true,protocol:'openid-connect',publicClient:false,standardFlowEnabled:false,directAccessGrantsEnabled:false},
  {clientId:'matterspace-vendor',enabled:true,protocol:'openid-connect',publicClient:false,secret:config.AM100_OAUTH_CLIENT_SECRET,serviceAccountsEnabled:true,standardFlowEnabled:false,directAccessGrantsEnabled:false,fullScopeAllowed:false,defaultClientScopes:['roles'],protocolMappers:[{name:'am100-audience',protocol:'openid-connect',protocolMapper:'oidc-audience-mapper',config:{'included.client.audience':'am100-api','access.token.claim':'true','id.token.claim':'false'}},{name:'api-roles',protocol:'openid-connect',protocolMapper:'oidc-usermodel-client-role-mapper',config:{'usermodel.clientRoleMapping.clientId':'am100-api','claim.name':'resource_access.am100-api.roles','jsonType.label':'String',multivalued:'true','access.token.claim':'true','id.token.claim':'false'}}]}
],clientScopeMappings:{'am100-api':[{client:'matterspace-vendor',roles}]},users:[{username:'service-account-matterspace-vendor',enabled:true,serviceAccountClientId:'matterspace-vendor',clientRoles:{'am100-api':roles}}]};
await writeFile(new URL('import/realm.json',root),JSON.stringify(realm,null,2));
const compose={name:'ethical-walls-matter',services:{keycloak:{image:'quay.io/keycloak/keycloak:26.8.1',command:['start-dev','--import-realm'],ports:['127.0.0.1:8180:8080'],environment:{KC_BOOTSTRAP_ADMIN_USERNAME:'admin',KC_BOOTSTRAP_ADMIN_PASSWORD:'${KEYCLOAK_ADMIN_PASSWORD}'},volumes:['keycloak-data:/opt/keycloak/data','./import:/opt/keycloak/data/import:ro']}},volumes:{'keycloak-data':{}}};
const composePath=fileURLToPath(new URL('compose.json',root));await writeFile(composePath,JSON.stringify(compose,null,2));
const result=spawnSync('docker',['compose','-f',composePath,'up','-d'],{stdio:'inherit',env:{...process.env,KEYCLOAK_ADMIN_PASSWORD:config.KEYCLOAK_ADMIN_PASSWORD}});
if(result.error||result.status!==0)throw Error('Start Docker Desktop with the Linux engine, then rerun npm run setup:oauth. Existing credentials were preserved.');
console.log('Keycloak is starting at http://localhost:8180. Local credentials: .local-data/oauth/config.json (never commit this file).');
console.log('Re-running setup preserves an existing realm. Later changes must be applied in the Keycloak console.');
