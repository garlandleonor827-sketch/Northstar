/** Executable contract examples, not the production Rust authorization layer. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const rules=JSON.parse(readFileSync(new URL('../contracts/core-rules.json',import.meta.url),'utf8'));
const fail=(message)=>{throw new Error(message)};
const clone=(x)=>structuredClone(x);
const object=(x)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function exact(x,fields){if(!object(x)||Object.keys(x).length!==fields.length||fields.some(k=>!Object.hasOwn(x,k)))fail('SHAPE')}
const text=(x,max=100)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const canonical=(x)=>Array.isArray(x)?x.map(canonical):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=(x)=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
function date(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
export function createStore(state){return {state:clone(state),audit:[],receipts:new Map()}}
export function applyWeekChange(store,request){
 exact(request,['schemaVersion','requestId','baseVersion','planId','reason','actions']);
 if(request.schemaVersion!==1||!text(request.requestId)||!text(request.planId)||!text(request.reason,1000)||!Number.isSafeInteger(request.baseVersion)||request.baseVersion<0)fail('SHAPE');
 if(!Array.isArray(request.actions)||request.actions.length<1||request.actions.length>20)fail('SHAPE');
 const digest=hash(request);
 if(store.receipts.has(request.requestId)){
  const receipt=store.receipts.get(request.requestId);if(receipt.hash!==digest)fail('ID_REUSED');
  return {...clone(receipt.result),replayed:true};
 }
 const before=store.state;
 if(!before.autoAdjust)fail('NOT_AUTHORIZED');
 if(before.id!==request.planId||before.version!==request.baseVersion)fail('STALE');
 if(before.primaryProjects.length>1)fail('MULTIPLE_PRIMARY');
 if(!Number.isSafeInteger(before.capacityMinutes)||before.capacityMinutes<0)fail('CAPACITY');
 const next=clone(before),seen=new Set();
 for(const a of request.actions){
  exact(a,['type','taskId','date','rank']);
  if(!['schedule_task','unschedule_task'].includes(a.type))fail('OPERATION');
  if(!text(a.taskId)||!Number.isSafeInteger(a.rank)||a.rank<0||a.rank>1000)fail('SHAPE');
  if(seen.has(a.taskId))fail('DUPLICATE_TARGET');seen.add(a.taskId);
  const t=next.tasks.find(t=>t.id===a.taskId);if(!t)fail('UNKNOWN_TASK');
  if(t.pinned||t.completed)fail('PROTECTED');
  if(a.type==='unschedule_task'){
   if(a.date!==null)fail('SHAPE');if(t.hardDue)fail('HARD_DUE');
   t.scheduledDate=null;
  }else{
   if(!date(a.date)||a.date<next.start||a.date>next.end)fail('OUT_OF_WEEK');
   if(t.hardDue&&a.date>t.hardDue)fail('HARD_DUE');t.scheduledDate=a.date;
  }
  t.rank=a.rank;
 }
 const scheduled=next.tasks.filter(t=>t.scheduledDate&&!t.completed);
 if(scheduled.reduce((sum,t)=>sum+t.minutes,0)>next.capacityMinutes)fail('CAPACITY');
 const slots=new Set();
 for(const t of scheduled){
  const slot=t.scheduledDate+':'+t.rank;if(slots.has(slot))fail('RANK_COLLISION');slots.add(slot);
  for(const depId of t.dependsOn){const d=next.tasks.find(x=>x.id===depId);
   if(!d)fail('DEPENDENCY');if(d.completed)continue;
   if(!d.scheduledDate||d.scheduledDate>t.scheduledDate||(d.scheduledDate===t.scheduledDate&&d.rank>=t.rank))fail('DEPENDENCY');
  }
 }
 next.version++;
 const result={version:next.version,scheduledMinutes:scheduled.reduce((sum,t)=>sum+t.minutes,0),replayed:false};
 // In production this block is ONE database transaction, including the receipt.
 store.audit.push({id:request.requestId,before:clone(before),after:clone(next),reason:request.reason});
 store.state=next;store.receipts.set(request.requestId,{hash:digest,result:clone(result)});
 return result;
}
export function undoLast(store,expectedVersion){
 if(store.state.version!==expectedVersion)fail('UNDO_CONFLICT');
 const last=store.audit.at(-1);if(!last||last.undoOf)fail('NOT_UNDOABLE');
 if(last.after.version!==store.state.version)fail('UNDO_CONFLICT');
 const restored=clone(last.before);
 const restoredMinutes=restored.tasks.filter(t=>t.scheduledDate&&!t.completed).reduce((s,t)=>s+t.minutes,0);
 if(restoredMinutes>store.state.capacityMinutes)fail('UNDO_CAPACITY_CONFLICT');
 restored.capacityMinutes=store.state.capacityMinutes;restored.version=store.state.version+1;
 store.audit.push({id:`undo:${last.id}`,undoOf:last.id,before:clone(store.state),after:clone(restored)});
 store.state=restored;return restored.version;
}
export function completionMetric(records,minimumCoverage=0.7){
 if(!Array.isArray(records)||!records.length)return {coverage:0,rate:null};
 const eligible=records.filter(x=>x.status!=='cancelled');
 if(!eligible.length)return {coverage:0,rate:null};
 const known=eligible.filter(x=>['completed','partial','not_done'].includes(x.status));
 const coverage=known.length/eligible.length;
 return {coverage,rate:coverage>=minimumCoverage&&known.length?known.filter(x=>x.status==='completed').length/known.length:null};
}
export function createGrowth(){return {events:[],seen:[],highestStage:1}}
export function validXP(g){return g.events.filter(e=>!e.revoked).reduce((s,e)=>s+e.award,0)}
export function creditGrowth(g,event,trustedPeriod){
 if(!Object.hasOwn(rules.awards,event.type)||!event.confirmed)return 0;
 if(!text(event.sourceId)||!/^\d{4}-W\d{2}$/.test(trustedPeriod))fail('GROWTH_SHAPE');
 const key=`${rules.ruleVersion}:${event.type}:${event.sourceId}`;
 if(g.seen.includes(key))return 0;
 const period=g.events.filter(e=>e.period===trustedPeriod);
 const same=period.filter(e=>e.type===event.type);
 if(same.length>=rules.limitsPerPeriod[event.type])return 0;
 const remaining=rules.weeklyCap-period.reduce((s,e)=>s+e.award,0);
 const award=Math.max(0,Math.min(rules.awards[event.type],remaining));
 if(!award)return 0;
 g.seen.push(key);g.events.push({key,type:event.type,sourceId:event.sourceId,period:trustedPeriod,award,revoked:false});
 const stage=rules.stageThresholds.filter(t=>validXP(g)>=t).length;
 g.highestStage=Math.max(g.highestStage,stage);return award;
}
export function revokeGrowth(g,key){const e=g.events.find(e=>e.key===key);if(e)e.revoked=true;return validXP(g);}
export function normalizeEndpoint(root,local=false){
 let u;try{u=new URL(root)}catch{fail('BAD_URL')}
 if(u.username||u.password||u.search||u.hash)fail('BAD_URL');
 const loopback=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
 if(u.protocol!=='https:'&&!(local&&loopback&&u.protocol==='http:'))fail('HTTPS_REQUIRED');
 if(/\/(chat\/completions|responses)\/?$/.test(u.pathname))fail('API_ROOT_REQUIRED');
 u.pathname=u.pathname.replace(/\/+$/,'')+'/chat/completions';return u.toString();
}
