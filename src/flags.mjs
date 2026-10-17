export const DEFAULT_FLAG_POLICIES=[
  {code:'ITAR',label:'ITAR',description:'Firm-assigned export-control classification. Configure the applicable workspace restrictions explicitly.'},
  {code:'NO_CLOUD',label:'No_Cloud',description:'This matter may not use cloud-hosted workspaces.',blockCloud:true},
  {code:'APAC',label:'APAC',description:'Firm-assigned APAC classification; geography alone does not imply a legal restriction.'},
  {code:'GDPR',label:'GDPR',description:'Firm-assigned privacy classification. Configure approved hosting regions explicitly.'},
  {code:'AI_RESTRICTED',label:'AI restricted',description:'AI use is restricted for this matter; reflects aiRestrictionsFlag in the supplied CM contract.',blockAI:true},
  {code:'NO_EXTERNAL_SHARING',label:'No external sharing',description:'External workspace sharing is not permitted.',blockExternal:true},
  {code:'EU_DATA_RESIDENCY',label:'EU data residency',description:'Firm policy requires an EU-hosted workspace.',allowedRegions:['EU']},
  {code:'US_DATA_RESIDENCY',label:'US data residency',description:'Firm policy requires a US-hosted workspace.',allowedRegions:['US']},
  {code:'CONFIDENTIAL',label:'Confidential',description:'Additional confidentiality classification; informational until configured.'},
  {code:'LEGAL_HOLD',label:'Legal hold',description:'Retention classification. This demo does not manage or delete documents.'},
  {code:'EXPORT_CONTROLLED',label:'Export controlled',description:'Additional firm-assigned export classification; configure restrictions explicitly.'}
].map(p=>({blockCloud:false,blockAI:false,blockExternal:false,allowedRegions:[],...p}));
export function normalizeFlags(values=[]) {
  if(!Array.isArray(values)||values.length>50)throw Object.assign(Error('Provide up to 50 flags.'),{status:400});
  const flags=[...new Set(values.map(v=>String(v).trim().toUpperCase().replace(/[ -]/g,'_')).filter(Boolean))];
  if(flags.some(v=>! /^[A-Z][A-Z0-9_]{0,39}$/.test(v)))throw Object.assign(Error('Flags must use letters, numbers, and underscores (up to 40 characters).'),{status:400});
  return flags;
}
export function flagConfiguration(s) {
  if(s.settings.enforceMatterFlags===undefined)s.settings.enforceMatterFlags=true;
  s.flagPolicies??=structuredClone(DEFAULT_FLAG_POLICIES);
  for(const m of s.matters){m.flags=normalizeFlags(m.flags||[]);for(const code of m.flags)if(!s.flagPolicies.some(p=>p.code===code))s.flagPolicies.push({code,label:code,description:'Custom firm flag',blockCloud:false,blockAI:false,blockExternal:false,allowedRegions:[]});}
  return s;
}
export function workspaceEnvironment(value) {
  // Legacy workspaces predate environment capture; keep the original demo default.
  if(value===undefined)return {hosting:'cloud',region:'US',aiEnabled:false,externalSharing:false};
  if(!value||!['cloud','on-premises'].includes(value.hosting)||!['US','EU','APAC','OTHER'].includes(value.region)||typeof value.aiEnabled!=='boolean'||typeof value.externalSharing!=='boolean')throw Object.assign(Error('Provide hosting, region, aiEnabled, and externalSharing in environment.'),{status:400});
  return {hosting:value.hosting,region:value.region,aiEnabled:value.aiEnabled,externalSharing:value.externalSharing};
}
export function evaluateFlags(s,m,environment) {
  flagConfiguration(s);
  const flags=m?.flags||[],policies=flags.map(code=>s.flagPolicies.find(p=>p.code===code)),violations=[];
  if(environment&&s.settings.enforceMatterFlags)for(const p of policies){
    if(p.blockCloud&&environment.hosting==='cloud')violations.push(p.code+': cloud hosting is prohibited');
    if(p.blockAI&&environment.aiEnabled)violations.push(p.code+': AI-enabled workspaces are prohibited');
    if(p.blockExternal&&environment.externalSharing)violations.push(p.code+': external sharing is prohibited');
    if(p.allowedRegions.length&&!p.allowedRegions.includes(environment.region))violations.push(p.code+': hosting must be in '+p.allowedRegions.join(' or '));
  }
  return {flags,flagPolicies:policies,enforcementEnabled:s.settings.enforceMatterFlags,environmentChecked:!!environment,workspaceAllowed:!!environment&&violations.length===0,restrictionViolations:violations};
}
