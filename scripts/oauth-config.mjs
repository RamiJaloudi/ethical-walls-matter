import {readFile} from 'node:fs/promises';
export async function loadOAuthConfig() {
  try{
    const config=JSON.parse(await readFile(new URL('../.local-data/oauth/config.json',import.meta.url),'utf8'));
    // Environment overrides support a manually configured realm without rewriting credentials.
    for(const [key,value] of Object.entries(config))if(process.env[key]===undefined)process.env[key]=String(value);
  }catch(e){if(e.code!=='ENOENT')throw e;}
}
