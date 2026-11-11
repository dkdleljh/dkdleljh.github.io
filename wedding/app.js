import {validateConfig,categories,states,won,kstDay,daysUntil,validatePlanner,prioritize,normalizeConflicts,resolveConflict} from './model.mjs';
const root=document.getElementById('app');let config,session=null,record=null,data=null,tab='overview',filter='전체',search='',month=kstDay().slice(0,7),busy=false,editing=false,error='',status='연결 중',authEpoch=0,refreshFlight=null;
const menus=[['overview','한눈에 보기','♡'],['board','일정 보드','▤'],['calendar','캘린더','▦'],['budget','계약 · 지출','₩'],['unknown','확인할 항목','?'],['vendors','업체 · 질문','☎'],['checklist','준비물 체크리스트','✓'],['decisions','의사결정 비교','⇄'],['sync','자동 동기화','↻']];
const styles=['wedding','photo','travel'];
const make=(tag,props={},...children)=>{const e=document.createElement(tag);for(const [k,v]of Object.entries(props)){if(k.startsWith('on'))e.addEventListener(k.slice(2).toLowerCase(),v);else if(k==='className')e.className=v;else if(k==='text')e.textContent=v;else if(v!==undefined&&v!==null)e.setAttribute(k,String(v));}for(const c of children.flat(Infinity))if(c!==null&&c!==undefined)e.append(c instanceof Node?c:document.createTextNode(String(c)));return e;};
const btn=(text,action,primary=false)=>make('button',{className:primary?'btn primary':'btn',type:'button',onClick:action,disabled:busy?'disabled':null},text);
const category=c=>make('span',{className:'category '+(styles[categories.indexOf(c)]||'wedding')},'● '+c);
const badge=(text,tone='sand')=>make('span',{className:'badge '+tone},text);
const panel=(...children)=>make('section',{className:'panel info-panel'},...children);
const link=(label,url)=>{try{const u=new URL(url);if(!['https:','http:','tel:'].includes(u.protocol))return make('span',{},label);}catch{return make('span',{},label);}return make('a',{href:url,target:'_blank',rel:'noopener noreferrer',className:'text-btn'},label+' ↗');};
const h3=t=>make('h3',{},t);const note=t=>make('p',{className:'small muted'},t||'미확인');
function notice(t){error=t;if(data)render();else authScreen(t);}
// Tokens stay in memory. The pending email is only a short-lived callback binding.
function forgetPending(){try{localStorage.removeItem('wedding.pendingLogin');}catch{}}
function endSession(message='로그인이 필요합니다.'){
 authEpoch++;session=null;record=null;data=null;refreshFlight=null;editing=false;
 document.querySelectorAll('dialog').forEach(d=>d.remove());
 try{localStorage.removeItem('wedding.session');}catch{}
 error=message;status='로그인 필요';authScreen(message);
}
async function api(path,method='GET',body,auth=true,token=auth?session?.access_token:undefined){
 const epoch=authEpoch;
 const r=await fetch(config.projectUrl+path,{method,headers:{apikey:config.publishableKey,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const p=await r.json().catch(()=>({}));
 if(!r.ok){if(auth&&r.status===401&&epoch===authEpoch)endSession('로그인이 만료되었습니다. 다시 로그인해 주세요.');throw Object.assign(Error(p.message||p.msg||p.error_description||p.error||'연결을 확인해 주세요.'),{status:r.status});}
 return p;
}
async function refreshSession(){
 if(!session)throw Error('다시 로그인해 주세요.');
 if(Number(session.expires_at||0)>Date.now()/1000+60)return;
 if(refreshFlight?.epoch===authEpoch)return refreshFlight.promise;
 const flight={epoch:authEpoch};refreshFlight=flight;
 flight.promise=(async()=>{try{
  const p=await api('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token},false);
  if(flight.epoch!==authEpoch)throw Error('로그인 상태가 변경되었습니다.');
  if(!p.access_token||!p.refresh_token||!Number.isFinite(p.expires_in)||p.expires_in<=0)throw Error('로그인 응답을 확인할 수 없습니다.');
  session={...p,expires_at:Date.now()/1000+p.expires_in};
 }catch(e){if(flight.epoch===authEpoch)endSession('로그인 갱신에 실패했습니다. 다시 로그인해 주세요.');throw e;}
 finally{if(refreshFlight===flight)refreshFlight=null;}})();
 return flight.promise;
}
function plannerRecord(row){
 if(!row||!validatePlanner(row.data)||!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('저장된 기록 형식 확인이 필요합니다.');
 return {...row,data:{...row.data,_sync:{...row.data._sync,conflicts:normalizeConflicts(row.data._sync?.conflicts)}}};
}
async function load(){
 if(busy||editing||!session)return;
 const epoch=authEpoch;
 try{await refreshSession();if(epoch!==authEpoch)return;
  const rows=await api('/rest/v1/wedding_planner_records?select=data,revision,updated_at&limit=1');
  if(epoch!==authEpoch)return;
  if(!rows.length)throw Error('이 로그인 계정에 연결된 플래너 기록이 없습니다.');
  record=plannerRecord(rows[0]);data=record.data;status='모든 변경 저장됨';error='';render();
 }catch(e){if(epoch===authEpoch)notice(e.message);}
}
async function persist(next){
 if(busy||!session||!record)return false;
 busy=true;const epoch=authEpoch;
 try{await refreshSession();if(epoch!==authEpoch)return false;
  const rows=await api('/rest/v1/rpc/save_wedding_planner','POST',{p_revision:record.revision,p_data:next});
  if(epoch!==authEpoch)return false;
  if(!rows.length)throw Error('다른 기기 또는 원본 동기화가 먼저 변경되었습니다. 최신 자료를 다시 불러온 뒤 수정해 주세요.');
  record=plannerRecord(rows[0]);data=record.data;status='모든 변경 저장됨';error='';return true;
 }catch(e){if(epoch===authEpoch)error=e.message;return false;}
 finally{busy=false;if(epoch===authEpoch)render();}
}
async function chooseConflict(id,useIncoming){
 try{await persist(resolveConflict(data,id,useIncoming));}catch(e){notice(e.message);}
}
function authScreen(message=''){root.replaceChildren(make('main',{className:'auth-wrap'},make('section',{className:'panel auth-card'},make('div',{className:'eyebrow'},'OUR NEXT CHAPTER'),make('h1',{},'우리의 다음 챕터'),make('p',{},'이 주소에서 로그인하고 웨딩 준비를 이어갑니다.'),make('p',{className:'small muted'},'화면을 닫거나 새로고침하면 다시 로그인합니다.'),message?make('p',{className:'form-error'},message):null,loginForm())));}
function loginForm(){if(!config||!validateConfig(config))return make('div',{},make('p',{},'개인 저장소 연결을 준비하고 있습니다.'),make('p',{className:'small muted'},'공개 화면에는 계약·지출·연락처 등 개인 기록을 포함하지 않습니다. 저장소 연결이 끝나면 이곳에서 로그인할 수 있습니다.'));const input=make('input',{type:'email',required:'required',autocomplete:'email',placeholder:'이메일 주소','aria-label':'로그인 이메일'});return make('form',{onSubmit:async e=>{e.preventDefault();const submit=e.currentTarget.querySelector('button');submit.disabled=true;try{localStorage.setItem('wedding.pendingLogin',JSON.stringify({email:input.value.trim().toLowerCase(),requestedAt:Date.now()}));await api('/auth/v1/otp?redirect_to='+encodeURIComponent('https://dkdleljh.github.io/wedding/'),'POST',{email:input.value.trim(),create_user:false},false);authScreen('이메일로 보낸 로그인 링크를 눌러 주세요. 링크를 열면 이 주소로 돌아옵니다.');}catch(err){forgetPending();authScreen(err.message);}finally{submit.disabled=false;}}},input,make('button',{className:'btn primary',type:'submit'},'이메일로 로그인 링크 받기'));}
function switchTab(t){tab=t;filter='전체';search='';render();window.scrollTo({top:0});}
function toolbar(action=true){const input=make('input',{placeholder:'항목 검색','aria-label':'항목 검색',value:search,onInput:e=>{search=e.target.value;const pos=e.target.selectionStart;render();const next=root.querySelector('[aria-label="항목 검색"]');next.focus();next.setSelectionRange(pos,pos);}});return make('div',{className:'toolbar'},make('div',{className:'segments'},['전체',...categories].map(c=>make('button',{className:filter===c?'active':'',onClick:()=>{filter=c;render();}},c))),make('div',{className:'toolbar-right'},make('label',{className:'search'},input),action?btn('+ 업무 추가',()=>edit('tasks',newTask()),true):null));}
const matches=t=>(filter==='전체'||t.category===filter)&&String(t.title||'').includes(search);
const newTask=()=>({id:crypto.randomUUID(),title:'',category:filter==='전체'?'예식':filter,status:'예정',priority:'보통',due:'',time:'',kind:'개인 목표',certainty:'계획',note:'',source:'',owner:'미정'});
function taskCard(t){const overdue=t.due&&daysUntil(t.due)<0&&/목표/.test(t.kind)&&t.status!=='완료';const select=make('select',{'aria-label':t.title+' 업무 상태',onChange:e=>persist({...data,tasks:data.tasks.map(i=>i.id===t.id?{...i,status:e.target.value}:i)})},states.map(s=>make('option',{value:s,selected:t.status===s?'selected':null},s)));return make('article',{className:'task-card'},make('div',{className:'card-top'},category(t.category),btn('수정',()=>edit('tasks',t))),make('button',{className:'task-title',onClick:()=>edit('tasks',t)},t.title),make('p',{},t.note||'세부 내용 미확인'),t.sourceNote?make('details',{className:'source-detail'},make('summary',{},'원본 메모'),note(t.sourceNote)):null,make('div',{className:'card-badges'},badge(t.certainty||'미확인'),t.priority==='높음'?badge('우선순위 높음','rose'):null),make('div',{className:'task-bottom'},make('span',{className:overdue?'overdue':''},(t.due||'날짜 미확인')+' '+(t.time||'')+(overdue?' · 목표 경과':'')),make('small',{},t.kind||'날짜 성격 미확인')),make('label',{className:'status-control'},'업무 상태',select));}
function table(headers,rows){return make('div',{className:'table-wrap'},make('table',{},make('thead',{},make('tr',{},headers.map(h=>make('th',{},h)))),make('tbody',{},rows.map(row=>make('tr',{},row.map(c=>make('td',{},c??'미확인')))))));}
function render(){if(!data)return authScreen(error);root.replaceChildren(make('div',{className:'shell'},make('aside',{className:'sidebar'},make('div',{className:'brand'},make('div',{className:'brand-icon'},'♡'),make('div',{},make('strong',{},'Our Next Chapter'),make('span',{},'WEDDING & HONEYMOON'))),make('div',{className:'sidebar-label'},'우리의 준비 공간'),make('nav',{},menus.map(([id,title,icon])=>make('button',{className:'nav-item '+(tab===id?'active':''),onClick:()=>switchTab(id)},make('span',{},icon),title))),make('div',{className:'sidebar-bottom'},note('로그인한 본인의 개인 기록'),btn('로그아웃',async()=>{const token=session?.access_token;endSession('로그아웃되었습니다.');forgetPending();try{await api('/auth/v1/logout','POST',{},false,token);}catch{}}))),make('div',{className:'workspace'},make('header',{className:'topbar'},make('div',{className:'breadcrumb'},'개인 웨딩 플래너',make('strong',{},menus.find(i=>i[0]===tab)[1])),make('span',{className:'sync'},status)),make('main',{},error?make('div',{className:'error-banner',role:'alert'},error,btn('최신 자료 다시 불러오기',load)):null,make('section',{className:'page-heading'},make('div',{},make('div',{className:'eyebrow'},'OUR WEDDING WORKSPACE'),make('h1',{},menus.find(i=>i[0]===tab)[1]),note('확정된 사실과 확인할 내용을 나누어 준비합니다.')),btn('기록 내보내기',()=>download('Wedding_Planner_Backup.json',JSON.stringify(data,null,2),'application/json'))),content(),make('footer',{},make('span',{},'♡ 우리의 다음 챕터를 위한 작은 준비'),make('span',{},'KST · 개인 기록은 로그인 후 표시됩니다.'))))));}
function content(){if(tab==='overview')return overview();if(tab==='board')return make('div',{},toolbar(),make('div',{className:'board'},states.map(s=>make('section',{className:'board-col'},h3(s),data.tasks.filter(t=>matches(t)&&t.status===s).map(taskCard)))));if(tab==='calendar')return calendar();if(tab==='budget')return budget();if(tab==='unknown')return make('div',{},toolbar(false),make('div',{className:'notice'},note('미확인은 미납·무료·완료를 뜻하지 않습니다. 원본과 실제 이행 여부를 확인합니다.')),make('div',{className:'cards-grid'},data.tasks.filter(t=>matches(t)&&t.status!=='완료'&&(t.certainty==='확인 필요'||t.status==='확인 필요')).map(taskCard)));if(tab==='vendors')return vendors();if(tab==='checklist')return checklist();if(tab==='decisions')return decisions();return syncPanel();}
function overview(){const wedding=data.tasks.find(t=>t.id==='wedding'),depart=data.tasks.find(t=>t.id==='depart'),confirmed=data.tasks.filter(t=>t.status==='완료').length,paid=data.expenses.reduce((s,i)=>s+(i.paid||0),0),pending=data.tasks.filter(t=>t.status!=='완료'&&(t.certainty==='확인 필요'||t.status==='확인 필요')).length;return make('div',{},make('section',{className:'hero-grid'},make('div',{className:'wedding-hero'},make('div',{className:'hero-copy'},make('span',{className:'hero-kicker'},'THE WEDDING DAY'),make('h2',{},wedding?.due||'예식일 미확인'),make('p',{},wedding?.time?wedding.time+' KST':'시각 미확인'),note(wedding?.note),make('div',{className:'hero-footer'},make('span',{className:'countdown'},wedding?.due?'D−'+daysUntil(wedding.due):'D-Day 미확인')))),make('div',{className:'travel-hero'},make('div',{className:'eyebrow'},'THE HONEYMOON'),make('h2',{},'Our journey.'),make('p',{},depart?.due||'출발일 미확인'),note(depart?.note))),make('div',{className:'stats-grid'},[[confirmed+' / '+data.tasks.length,'준비 완료'],[won(paid),'확인 지급액'],[pending+'건','확인할 항목'],[data.tasks.filter(t=>t.due&&daysUntil(t.due)>=0&&daysUntil(t.due)<=7&&t.status!=='완료').length+'건','다가오는 7일']].map(([v,l])=>make('div',{className:'stat'},make('div',{},l),make('strong',{},v)))),panel(h3('지금 먼저 확인할 일'),make('div',{className:'cards-grid'},prioritize(data.tasks).slice(0,6).map(taskCard))),btn('자동 동기화 내역',()=>switchTab('sync')));}
function calendar(){const monthInput=make('input',{type:'month',value:month,'aria-label':'표시 월',onChange:e=>{month=e.target.value;render();}});const [y,m]=month.split('-').map(Number),offset=new Date(y,m-1,1).getDay(),count=new Date(y,m,0).getDate();return make('div',{},toolbar(),panel(make('div',{className:'section-heading'},h3(month.replace('-','년 ')+'월'),monthInput),make('div',{className:'calendar-grid'},['일','월','화','수','목','금','토'].map(d=>make('div',{className:'weekday'},d)),Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{const n=i-offset+1,date=month+'-'+String(n).padStart(2,'0');return make('div',{className:'calendar-cell '+(n<1||n>count?'outside':'')},n>0&&n<=count?[make('span',{className:'day-number'},n),data.tasks.filter(t=>matches(t)&&t.due===date).map(t=>make('button',{className:'calendar-event '+styles[categories.indexOf(t.category)],onClick:()=>edit('tasks',t)},(t.time||'')+' '+t.title))]:null);}))),make('div',{className:'cards-grid'},data.tasks.filter(t=>matches(t)&&t.due?.startsWith(month)).map(taskCard)));}
function budget(){const add=()=>edit('expenses',{id:crypto.randomUUID(),title:'',category:'예식',amount:null,type:'미확인',paid:null,date:'',note:'',source:''});return make('div',{},toolbar(false),make('div',{className:'notice'},note('계약 금액·지급 거래·안내 옵션은 서로 다릅니다. 지급 거래를 다른 계약·사진 옵션에 임의 배분하지 않습니다.')),panel(make('div',{className:'section-heading'},h3('계약 · 지출 원장'),btn('+ 항목 추가',add,true)),table(['항목','분류','기준 금액','확인 지급액','내용',''],data.expenses.filter(matches).map(e=>[make('strong',{},e.title),make('div',{},category(e.category),note(e.type)),won(e.amount),won(e.paid),make('div',{},note(e.note),e.source?link('근거',e.source):null),btn('수정',()=>edit('expenses',e))]))),panel(h3('식대 시뮬레이션'),note('본인 계약의 단가와 인원을 직접 입력합니다. 보증 인원 계산 규칙은 업체 확인이 필요합니다.'),mealForm()));}
function mealForm(){const a=make('input',{type:'number',min:'0',placeholder:'대인 수','aria-label':'대인 수'}),b=make('input',{type:'number',min:'0',placeholder:'대인 단가 원','aria-label':'대인 단가'}),c=make('input',{type:'number',min:'0',placeholder:'소인 수','aria-label':'소인 수'}),d=make('input',{type:'number',min:'0',placeholder:'소인 단가 원','aria-label':'소인 단가'}),result=make('p');return make('form',{className:'form-grid',onSubmit:e=>{e.preventDefault();if([a,b,c,d].some(i=>i.value==='')){result.textContent='인원과 단가를 모두 입력해 주세요.';return;}const n=[a,b,c,d].map(i=>Math.max(0,Math.floor(Number(i.value))));result.textContent=n[0]+' × '+won(n[1])+' + '+n[2]+' × '+won(n[3])+' = '+won(n[0]*n[1]+n[2]*n[3])+' (단순 시나리오)';}},a,b,c,d,make('button',{className:'btn',type:'submit'},'계산'),result);}
function vendors(){return make('div',{className:'vendor-grid'},data.vendors.map(v=>panel(make('div',{className:'section-heading'},h3(v.name),btn('수정',()=>edit('vendors',v))),note(v.role),v.phone?link(v.phone,'tel:'+v.phone):note('직통 연락처 미확인'),v.website?link('홈페이지',v.website):null,make('ol',{className:'questions'},String(v.questions||'').split('\n').filter(Boolean).map(q=>make('li',{},q))),note(v.note))));}
function checklist(){return make('div',{},toolbar(false),make('div',{className:'check-grid'},categories.filter(c=>filter==='전체'||filter===c).map(c=>panel(category(c),data.checks.filter(i=>i.category===c&&i.title.includes(search)).map(i=>make('div',{className:'check-row '+(i.done?'done':'')},make('button',{className:'check-main',onClick:()=>persist({...data,checks:data.checks.map(j=>j.id===i.id?{...j,done:!j.done}:j)})},make('span',{className:'checkbox'},i.done?'✓':''),i.title),btn('수정',()=>edit('checks',i)))),btn('+ 준비물 추가',()=>edit('checks',{id:crypto.randomUUID(),title:'',category:c,done:false}))))));}
function decisions(){return make('div',{},make('div',{className:'decision-grid'},data.decisions.map(d=>panel(h3(d.title),badge(d.choice||'미정'),note(d.note),btn('결정 기록',()=>edit('decisions',d))))),panel(h3('여행기간 비교 · 계획 초안'),table(['비교','10일','12일','14일'],[['일정 구성','핵심 도시 위주','관광·휴식 균형','체류·휴식 여유'],['항공·숙소 총액','미확인','미확인','미확인'],['실제 귀국일','항공 확정 후 확인','항공 확정 후 확인','항공 확정 후 확인'],['검토할 점','이동일 비중','도시 간 동선','예산·휴가 일수']])));}
function syncPanel(){const sync=data._sync||{};return make('div',{},make('div',{className:'notice'},note('원본→사이트 단방향 대조. 원본 조회 실패와 직접 수정값 충돌을 성공으로 처리하지 않습니다.')),panel(make('div',{className:'section-heading'},h3('최근 원본 확인'),btn('저장된 최신자료 불러오기',load)),table(['원본','상태','최근 성공'],Object.entries(sync.sourceStatus||{}).map(([name,s])=>[name,s.status||'미확인',s.lastSuccessAt||'미확인']))),panel(h3('확인 필요 · 충돌'),(sync.conflicts||[]).map(c=>panel(h3((c.title||c.recordId)+' · '+c.field),note('직접 수정: '+String(c.local)),note('원본 새 값: '+String(c.incoming)),btn('사이트 값 유지',()=>chooseConflict(c.id,false)),btn('원본 반영',()=>chooseConflict(c.id,true),true))),(sync.sourceConflicts||[]).map(c=>note((c.note||'원본 간 불일치')+' · '+c.recordId)),!(sync.conflicts?.length||sync.sourceConflicts?.length)?note('보고된 충돌이 없습니다.'):null),panel(h3('조회 경고'),(sync.warnings||[]).map(w=>note(w)),!sync.warnings?.length?note('보고된 경고가 없습니다.'):null),panel(h3('Calendar 등록 원문'),table(['일정','시작','종료'],(sync.calendarEvents||[]).map(e=>[e.title,e.start||'미확인',String(e.end||'미확인')+' · 실제 종료 확정과 구분']))));}
function edit(type,item){editing=true;const r=structuredClone(item),fields={tasks:[['title','업무명','text'],['category','분류',categories],['status','업무 상태',states],['priority','우선순위',['높음','보통','낮음']],['certainty','사실 확인',['확정','일정 확정','계획','확인 필요','미확인']],['due','날짜','date'],['time','한국 시각','time'],['kind','날짜의 성격',['확정 일정','예약 일정','희망 일정','개인 목표','안내 기준 목표','기한 미확인','캘린더 등록']],['owner','담당','text'],['note','내용·미확인 항목','area'],['source','근거 링크','url']],expenses:[['title','항목명','text'],['category','분류',categories],['type','금액 성격',['계약 기준','확정 별도비','지급 거래','안내 옵션','계약 별도 안내','미확인']],['amount','기준 금액(원) · 미확인은 비우기','number'],['paid','확인 지급액(원) · 미확인은 비우기','number'],['date','지급일','date'],['note','포함·지급 근거','area'],['source','근거 링크','url']],checks:[['title','준비물','text'],['category','분류',categories]],vendors:[['name','업체명','text'],['role','역할','text'],['phone','연락처','tel'],['website','홈페이지','url'],['questions','질문 · 한 줄에 하나','area'],['note','답변·확인일·미확인 항목','area']],decisions:[['title','비교 항목','text'],['choice','현재 결정','text'],['note','판단 근거·다음 확인','area']]}[type];
 const inputs=fields.map(([key,label,kind])=>{let input;if(Array.isArray(kind))input=make('select',{},kind.map(v=>make('option',{value:v,selected:r[key]===v?'selected':null},v)));else input=make(kind==='area'?'textarea':'input',{type:kind==='area'?null:kind,value:kind==='area'?null:r[key]??'',rows:kind==='area'?4:null,min:kind==='number'?0:null,required:key==='title'||key==='name'?'required':null},kind==='area'?r[key]||'':null);input.dataset.field=key;input.dataset.kind=kind;return make('label',{},label,input);});const message=make('p',{className:'form-error'});const dialog=make('dialog',{className:'modal'},make('form',{onSubmit:async e=>{e.preventDefault();for(const input of dialog.querySelectorAll('[data-field]'))r[input.dataset.field]=input.dataset.kind==='number'?(input.value===''?null:Number(input.value)):input.value;const list=data[type],next={...data,[type]:list.some(i=>i.id===r.id)?list.map(i=>i.id===r.id?r:i):[...list,r]};if(await persist(next)){editing=false;dialog.remove();}else message.textContent=error;}},make('div',{className:'modal-heading'},make('h2',{},'준비 기록')),make('div',{className:'modal-fields'},inputs,message),make('div',{className:'modal-actions'},btn('닫기',()=>{editing=false;dialog.close();dialog.remove();}),make('button',{className:'btn primary',type:'submit'},'변경 저장'))));dialog.addEventListener('cancel',()=>{editing=false;dialog.remove();});document.body.append(dialog);dialog.showModal();}
function download(name,content,type){const a=make('a',{href:URL.createObjectURL(new Blob([content],{type})),download:name});a.click();URL.revokeObjectURL(a.href);}
async function boot(){
 const hash=new URLSearchParams(location.hash.slice(1));
 // Strip callback secrets before loading config or making any request.
 if(location.hash)history.replaceState(null,'',location.pathname);
 try{
  try{localStorage.removeItem('wedding.session');}catch{}
  config=await fetch('./config.json',{cache:'no-store'}).then(r=>r.json());
  if(!validateConfig(config)){authScreen();return;}
  if(hash.has('error')){forgetPending();authScreen('로그인 링크를 사용할 수 없습니다. 다시 요청해 주세요.');return;}
  if(!hash.has('access_token')){authScreen();return;}
  let pending;try{pending=JSON.parse(localStorage.getItem('wedding.pendingLogin'));}catch{}
  forgetPending();
  const age=Date.now()-Number(pending?.requestedAt);
  if(!pending?.email||!Number.isFinite(age)||age<0||age>15*60*1000)throw Error('이 브라우저에서 로그인 링크를 다시 요청해 주세요.');
  const seconds=Number(hash.get('expires_in'));
  const candidate={access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_at:Date.now()/1000+seconds};
  if(!candidate.refresh_token||!Number.isFinite(seconds)||seconds<=0||seconds>86400)throw Error('로그인 응답을 확인할 수 없습니다.');
  const epoch=authEpoch;
  const user=await api('/auth/v1/user','GET',undefined,true,candidate.access_token);
  if(epoch!==authEpoch)return;
  if(!user.id||user.is_anonymous===true||user.email?.toLowerCase()!==pending.email||!user.email_confirmed_at)throw Error('요청한 이메일의 인증을 확인할 수 없습니다.');
  session=candidate;authEpoch++;await load();
 }catch(e){endSession(e.message);}
}
setInterval(()=>{if(session&&data&&!busy&&!editing)load();},60000);boot();

