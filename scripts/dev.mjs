import {startApp} from './server.mjs';
const directory=new URL('../.local-data/',import.meta.url);
const firm=await startApp({role:'firm',port:4311,directory,peerUrl:'http://localhost:4312'});
const vendor=await startApp({role:'vendor',port:4312,directory,firmUrl:process.env.FIRM_URL||firm.url,peerUrl:"http://localhost:4311"});
console.log('AM100 Firm Control: '+firm.url+'\nMatterSpace Vendor: '+vendor.url+'\nPersistent demo records: .local-data/');
function stop(){firm.server.close();vendor.server.close();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
