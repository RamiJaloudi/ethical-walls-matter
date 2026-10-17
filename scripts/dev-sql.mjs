import {startApp} from './server.mjs';
import {sqlStore} from '../src/sql-store.mjs';
const firmStore=sqlStore('firm'),vendorStore=sqlStore('vendor');
await firmStore.read();await vendorStore.read();
const firm=await startApp({role:'firm',port:4311,store:firmStore,peerUrl:'http://localhost:4312'});
const vendor=await startApp({role:'vendor',port:4312,store:vendorStore,firmUrl:firm.url,peerUrl:'http://localhost:4311'});
console.log('AM100 Firm Control + APIs: http://localhost:4311\nMatterSpace Vendor: http://localhost:4312\nDatabase: '+(process.env.AM100_SQL_SERVER||'.\\SQLEXPRESS')+' / AM100IntegrationDemo\nSource: SQL views; Windows authentication');
function stop(){firm.server.close();vendor.server.close();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
