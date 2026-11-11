export function validateConfig(config){try{if(typeof config?.projectUrl!=='string'||typeof config?.publishableKey!=='string')return false;const u=new URL(config.projectUrl);return u.protocol==='https:'&&/^[a-z0-9]+\.supabase\.co$/.test(u.hostname)&&!u.username&&!u.password&&!u.port&&u.pathname==='/'&&!u.search&&!u.hash&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);}catch{return false;}}
export const categories=['예식','촬영','신혼여행'];
export const states=['예정','진행 중','확인 필요','완료'];
export const won=n=>n===null||n===undefined?'미확인':Number(n).toLocaleString('ko-KR')+'원';
export const kstDay=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
export const daysUntil=d=>d?Math.round((Date.parse(d+'T00:00:00+09:00')-Date.parse(kstDay()+'T00:00:00+09:00'))/86400000):null;
export function validatePlanner(p){return !!p&&['tasks','expenses','checks','vendors','decisions'].every(k=>Array.isArray(p[k])&&p[k].every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&typeof r.id==='string'&&r.id.length>0)&&new Set(p[k].map(r=>r.id)).size===p[k].length)&&(!p._sync||(typeof p._sync==='object'&&!Array.isArray(p._sync)&&(!p._sync.conflicts||Array.isArray(p._sync.conflicts))));}
export function prioritize(tasks){return tasks.filter(t=>t.status!=='완료').sort((a,b)=>score(b)-score(a));}
function score(t){const d=daysUntil(t.due);return (t.priority==='높음'?100:0)+(t.certainty==='확인 필요'?25:0)+(d!==null&&d<0&&/목표/.test(t.kind)?40:0)+(d!==null&&d>=0&&d<=7?30:0);}
const sourceCollections=['tasks','expenses','vendors'];
const safeField=k=>!['id','__proto__','constructor','prototype'].includes(k);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const conflictId=c=>[c.collection,c.recordId,c.field].map(encodeURIComponent).join('/');
export function normalizeConflicts(conflicts=[]){const byId=new Map();for(const c of conflicts){if(!c||!sourceCollections.includes(c.collection)||typeof c.recordId!=='string'||typeof c.field!=='string'||!safeField(c.field))throw Error('동기화 충돌 형식 확인이 필요합니다.');const copy=structuredClone(c);copy.id=conflictId(copy);byId.set(copy.id,copy);}return [...byId.values()];}
export function resolveConflict(planner,id,useIncoming=false){const out=structuredClone(planner),conflicts=normalizeConflicts(out._sync?.conflicts),c=conflicts.find(c=>c.id===id);if(!c)throw Error('처리할 충돌을 다시 확인해 주세요.');const row=out[c.collection].find(r=>r.id===c.recordId);if(!row)throw Error('충돌 항목이 없습니다. 최신 자료를 다시 불러와 주세요.');if(useIncoming)row[c.field]=structuredClone(c.incoming);out._sync={...out._sync,conflicts:conflicts.filter(c=>c.id!==id)};return out;}
export function incomingMerge(local,priorSource,nextSource){
 const out=structuredClone(local),pending=new Map(normalizeConflicts(out._sync?.conflicts).map(c=>[c.id,c]));
 for(const collection of sourceCollections)for(const incoming of nextSource[collection]||[]){
  let current=out[collection].find(r=>r.id===incoming.id);
  if(!current){out[collection].push(structuredClone(incoming));continue;}
  const prior=(priorSource[collection]||[]).find(r=>r.id===incoming.id)||{};
  for(const [field,value]of Object.entries(incoming)){
   if(!safeField(field))continue;
   const id=conflictId({collection,recordId:incoming.id,field});
   if(same(current[field],value)){pending.delete(id);continue;}
   if(same(value,prior[field])){if(pending.has(id))pending.set(id,{...pending.get(id),local:structuredClone(current[field]),incoming:structuredClone(value)});continue;}
   if(current[field]===undefined||same(current[field],prior[field])){current[field]=structuredClone(value);pending.delete(id);}
   else pending.set(id,{id,collection,recordId:incoming.id,field,local:structuredClone(current[field]),incoming:structuredClone(value)});
  }
 }
 const conflicts=[...pending.values()];out._sync={...out._sync,conflicts};return {data:out,conflicts};
}

