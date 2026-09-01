/* 교사별 수정 권한·개인 설정 확장 — 기존 index.html 뒤에 로드 */
(function(){
  'use strict';
  const PREF_BASE='gijang_teacher_preferences_v1';
  let originalBuildTeacherAccounts=buildTeacherAccounts;
  let originalEstablishLogin=establishLogin_;
  let originalOpenDayModal=openDayModal;
  let originalRenderNotices=renderNotices;
  let originalLoadAll=loadAll;

  function isMasterUser(){return currentRole==='admin'||/^(마스터|master|admin|관리자)$/i.test(String(currentAccountId||''))||/^(마스터|master|admin|관리자)$/i.test(String(currentUser||''));}
  function permissionFor(key){
    const account=(teacherAccounts||[]).find(function(a){return a.id===currentAccountId;});
    return isMasterUser()||!!(account&&account.permissions&&account.permissions[key]);
  }
  function prefsKey(){return PREF_BASE+'::'+(currentAccountId||'guest');}
  function preferences(){try{return Object.assign({dutyAlert:true,calendarAlert:false,noticeAlert:false},JSON.parse(localStorage.getItem(prefsKey())||'{}'));}catch(e){return {dutyAlert:true,calendarAlert:false,noticeAlert:false};}}
  function savePreferences(values){localStorage.setItem(prefsKey(),JSON.stringify(values));}
  function asBool(v){return ['1','true','허용','yes','y','on'].indexOf(String(v||'').trim().toLowerCase())>=0;}

  buildTeacherAccounts=function(rows){
    originalBuildTeacherAccounts(rows);
    if(!Array.isArray(rows)||!rows.length)return;
    const header=rows[0].map(function(v){return String(v||'').trim();});
    const find=function(label){return header.findIndex(function(h){return h.replace(/\s/g,'').includes(label);});};
    const cal=find('학사일정수정'), notice=find('전달사항수정'), duty=find('급식당번수정');
    teacherAccounts.forEach(function(account){
      const row=rows.slice(1).find(function(item){return String(item[header.findIndex(function(h){return /아이디|로그인/.test(h);})]||'').trim()===account.id;});
      if(!row)return;
      account.permissions={calendar:account.role==='admin'||(cal>=0&&asBool(row[cal])),notice:account.role==='admin'||(notice>=0&&asBool(row[notice])),duty:account.role==='admin'||(duty>=0&&asBool(row[duty]))};
    });
  };

  async function postApp(payload){
    const url=getTimetableServerUrl();
    if(!url) return {success:false,error:'Apps Script 웹앱 주소가 없습니다. 마스터가 회원 명부 관리에서 /exec 주소를 먼저 저장하세요.'};
    try{
      const res=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
      return await res.json();
    }catch(e){return {success:false,error:'네트워크 오류로 저장하지 못했습니다.'};}
  }
  postRowToSheet=async function(sheetName,row,action,rowNumber){
    const resource=sheetName==='학사일정'?'calendar':(sheetName==='담임교사 전달사항'?'notice':'');
    if(!resource)return {success:false,error:'기존 급식 당번표 대신 내 설정의 조별 반복 급식 당번표를 사용하세요.'};
    const allowed=resource==='calendar'?permissionFor('calendar'):permissionFor('notice');
    if(!allowed)return {success:false,error:'이 항목의 수정 권한이 없습니다. 마스터 관리자에게 권한을 요청하세요.'};
    const mode=action==='updateRow'?'update':action==='deleteRow'?'delete':'append';
    return postApp({action:'dashboardWrite',resource:resource,mode:mode,row:row,rowNumber:rowNumber,loginId:currentAccountId,password:currentLoginPassword});
  };

  function injectCss(){
    const style=document.createElement('style');
    style.textContent='.settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.settings-grid .card{padding:22px}.settings-grid h3{margin-top:0}.setting-option{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--border);font-size:14px}.setting-option:last-child{border:0}.setting-option input{width:18px;height:18px;accent-color:var(--accent)}.permissions-table{width:100%;border-collapse:collapse}.permissions-table th,.permissions-table td{padding:10px 8px;border-bottom:1px solid var(--border);text-align:left;font-size:14px}.permissions-table th{color:var(--text-soft)}.permissions-table input{width:18px;height:18px;accent-color:var(--accent)}.duty-edit-table{width:100%;border-collapse:collapse;min-width:680px}.duty-edit-table th,.duty-edit-table td{border:1px solid var(--border);padding:5px;background:#fffdf6}.duty-edit-table input{width:100%;min-width:72px;padding:7px;border:0;background:transparent}.duty-edit-scroll{overflow:auto}.settings-message{font-size:13px;min-height:20px;margin-top:10px}.settings-message.ok{color:#266649}.settings-message.err{color:#9d3e2b}@media(max-width:760px){.settings-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }
  function openPersonalSettings(){
    document.querySelectorAll('nav.tabs button').forEach(function(x){x.classList.remove('active');});
    document.querySelectorAll('section.tab').forEach(function(x){x.classList.remove('active');});
    const panel=document.getElementById('tab-settings');if(panel)panel.classList.add('active');
    renderSettings();
  }
  function openPermissionsTab(){
    document.querySelectorAll('nav.tabs button').forEach(function(x){x.classList.remove('active');});
    const tab=document.querySelector('nav.tabs button[data-tab="permissions"]');if(tab)tab.classList.add('active');
    document.querySelectorAll('section.tab').forEach(function(x){x.classList.remove('active');});
    const panel=document.getElementById('tab-permissions');if(panel)panel.classList.add('active');
    renderMasterPermissions();
  }
  function injectSettings(){
    const nav=document.querySelector('nav.tabs');
    const members=nav&&nav.querySelector('[data-tab="members"]');
    if(nav&&!nav.querySelector('[data-tab="permissions"]')){
      const b=document.createElement('button');b.dataset.tab='permissions';b.id='permissions-tab-btn';b.style.display='none';b.textContent='교사 작성 및 접근 권한';
      nav.insertBefore(b,members||null);b.addEventListener('click',openPermissionsTab);
    }
    if(!document.getElementById('tab-settings')){
      const section=document.createElement('section');section.className='tab';section.id='tab-settings';
      section.innerHTML='<div class="section-title"><div><h2>내 설정</h2><p>비밀번호, 접속 알림과 나에게 허용된 수정 권한을 관리합니다.</p></div></div><div id="settings-content"></div>';
      const modal=document.getElementById('day-modal');modal.parentNode.insertBefore(section,modal);
    }
    if(!document.getElementById('tab-permissions')){
      const section=document.createElement('section');section.className='tab';section.id='tab-permissions';
      section.innerHTML='<div class="section-title"><div><h2>교사 작성 및 접근 권한</h2><p>교사 계정을 확인하고, 교사별로 학사일정·담임교사 전달사항·조별 반복 급식 당번표의 작성 권한을 제어합니다.</p></div></div><div id="master-permissions-area"></div>';
      const modal=document.getElementById('day-modal');modal.parentNode.insertBefore(section,modal);
    }
  }
  function settingRow(id,title,text){return '<label class="setting-option"><input type="checkbox" id="'+id+'"><span><b>'+title+'</b><br><small>'+text+'</small></span></label>';}
  function updateDashboardEditControls(){
    const calendar=permissionFor('calendar'), notice=permissionFor('notice'), duty=permissionFor('duty');
    const calToggle=document.getElementById('qa-cal-toggle'),noticeToggle=document.getElementById('qa-notice-toggle'),dutyToggle=document.getElementById('weekly-duty-sheet-open-btn');
    if(calToggle)calToggle.style.display=calendar?'':'none';
    if(noticeToggle)noticeToggle.style.display=notice?'':'none';
    if(dutyToggle)dutyToggle.style.display=duty?'':'none';
    if(!calendar){const f=document.getElementById('qa-cal-form');if(f)f.classList.remove('show');}
    if(!notice){const f=document.getElementById('qa-notice-form');if(f)f.classList.remove('show');}
    if(!duty){const f=document.getElementById('weekly-duty-edit-form');if(f)f.classList.remove('show');}
  }
  function renderSettings(){
    const root=document.getElementById('settings-content');if(!root)return;
    updateDashboardEditControls();
    const p=preferences();
    root.innerHTML='<div class="settings-grid"><article class="card"><h3>개인 계정 설정</h3><p class="progress-note">현재 로그인 계정의 비밀번호와 알림 방식을 변경합니다.</p><label class="field">현재 비밀번호<input id="my-current-password" type="password" autocomplete="current-password"></label><label class="field">새 비밀번호<input id="my-new-password" type="password" minlength="4" autocomplete="new-password"></label><label class="field">새 비밀번호 확인<input id="my-new-password-confirm" type="password" minlength="4" autocomplete="new-password"></label><button class="btn primary" id="my-password-save" type="button">비밀번호 변경</button><div id="my-password-status" class="settings-message"></div></article><article class="card"><h3>접속 알림</h3>'+settingRow('pref-duty-alert','오늘 급식 당번 알림','접속 시 오늘 내가 담당한 급식 당번이 있으면 팝업으로 알려줍니다.')+settingRow('pref-calendar-alert','오늘 학사일정 알림','접속 시 오늘의 학사일정이 있으면 알려줍니다.')+settingRow('pref-notice-alert','담임 전달사항 알림','접속 시 현재 적용 중인 담임교사 전달사항이 있으면 알려줍니다.')+'<button class="btn primary" id="my-pref-save" type="button" style="margin-top:14px">알림 설정 저장</button><div id="my-pref-status" class="settings-message"></div></article></div><div id="duty-settings-area"></div><div id="master-permissions-area"></div>';
    document.getElementById('pref-duty-alert').checked=p.dutyAlert!==false;document.getElementById('pref-calendar-alert').checked=!!p.calendarAlert;document.getElementById('pref-notice-alert').checked=!!p.noticeAlert;
    document.getElementById('my-pref-save').onclick=function(){savePreferences({dutyAlert:document.getElementById('pref-duty-alert').checked,calendarAlert:document.getElementById('pref-calendar-alert').checked,noticeAlert:document.getElementById('pref-notice-alert').checked});const s=document.getElementById('my-pref-status');s.className='settings-message ok';s.textContent='이 기기의 알림 설정을 저장했습니다.';};
    document.getElementById('my-password-save').onclick=changeMyPassword;
    renderDutySettings();
  }
  async function changeMyPassword(){
    const current=document.getElementById('my-current-password').value,newPw=document.getElementById('my-new-password').value,confirmPw=document.getElementById('my-new-password-confirm').value,status=document.getElementById('my-password-status');
    if(!current||newPw.length<4||newPw!==confirmPw){status.className='settings-message err';status.textContent='현재 비밀번호와 4자 이상의 동일한 새 비밀번호를 입력하세요.';return;}
    status.className='settings-message';status.textContent='변경 중...';
    const result=await postApp({action:'passwordChange',loginId:currentAccountId,currentPassword:current,newPassword:newPw});
    if(result.success){currentLoginPassword=newPw;try{const stored=JSON.parse(localStorage.getItem(USER_STORAGE_KEY)||'{}');if(stored.id===currentAccountId){stored.password=newPw;localStorage.setItem(USER_STORAGE_KEY,JSON.stringify(stored));}}catch(e){}status.className='settings-message ok';status.textContent='비밀번호를 변경했습니다. 다음 로그인부터 새 비밀번호를 사용하세요.';document.getElementById('my-current-password').value='';document.getElementById('my-new-password').value='';document.getElementById('my-new-password-confirm').value='';}else{status.className='settings-message err';status.textContent=result.error||'비밀번호를 변경하지 못했습니다.';}
  }
  function renderDutySettings(){
    const root=document.getElementById('weekly-duty-edit-form');if(!root)return;
    if(!permissionFor('duty')){root.innerHTML='';return;}
    root.innerHTML='<div class="quickadd-row" style="align-items:end"><div><label class="qa-inline">수정할 조</label><select id="duty-edit-group"><option value="1">1조</option><option value="2">2조</option></select></div><div class="progress-note" style="margin:0">조별 반복 당번표 시트에 바로 저장됩니다.</div></div><div class="duty-edit-scroll" style="margin-top:10px"><table class="duty-edit-table"><thead><tr><th>업무</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th></tr></thead><tbody id="duty-edit-body"></tbody></table></div><div class="quickadd-actions" style="margin-top:12px"><button class="btn primary" id="duty-edit-save" type="button">저장</button><button class="btn" id="duty-edit-cancel" type="button">취소</button></div><div id="duty-edit-status" class="settings-message"></div>';
    const select=document.getElementById('duty-edit-group');select.value=String(weeklyDutyRotation.activeGroup||1);select.onchange=renderDutyEditRows;document.getElementById('duty-edit-save').onclick=saveDutyEdit;document.getElementById('duty-edit-cancel').onclick=function(){root.classList.remove('show');};renderDutyEditRows();
  }
  function toggleDutyEditor(){const root=document.getElementById('weekly-duty-edit-form');if(!root||!permissionFor('duty'))return;renderDutySettings();root.classList.toggle('show');}
  function renderDutyEditRows(){const group=Number(document.getElementById('duty-edit-group').value);const rows=(weeklyDutyRotation.groups[group]||[]).slice(0,5);const body=document.getElementById('duty-edit-body');body.innerHTML=Array.from({length:5},function(_,i){const r=rows[i]||{task:'업무 '+(i+1),days:['','','','','']};return '<tr><td><input data-duty-task value="'+escapeHtml(r.task||'')+'"></td>'+[0,1,2,3,4].map(function(d){return '<td><input data-duty-day="'+d+'" value="'+escapeHtml((r.days||[])[d]||'')+'"></td>';}).join('')+'</tr>';}).join('');}
  async function saveDutyEdit(){const group=Number(document.getElementById('duty-edit-group').value), status=document.getElementById('duty-edit-status'),rows=Array.from(document.querySelectorAll('#duty-edit-body tr')).map(function(tr){return {task:tr.querySelector('[data-duty-task]').value,days:Array.from(tr.querySelectorAll('[data-duty-day]')).map(function(el){return el.value;})};});status.className='settings-message';status.textContent='시트에 저장 중...';const result=await postApp({action:'dutyRotationSave',group:group,rows:rows,loginId:currentAccountId,password:currentLoginPassword});if(result.success){status.className='settings-message ok';status.textContent='조별 반복 당번표를 저장했습니다.';await loadAll();}else{status.className='settings-message err';status.textContent=result.error||'당번표를 저장하지 못했습니다.';}}
  function renderMasterPermissions(){
    const root=document.getElementById('master-permissions-area');if(!root)return;
    const teachers=(teacherAccounts||[]).filter(function(a){return a.role!=='admin';});
    root.innerHTML='<article class="card" style="margin-top:18px"><h3>교사별 수정 권한</h3><p class="progress-note">여기에서 허용한 교사만 웹에서 해당 항목을 수정하고 시트에 저장할 수 있습니다.</p><div style="overflow:auto"><table class="permissions-table"><thead><tr><th>교사</th><th>학사일정</th><th>담임 전달사항</th><th>급식 당번표</th><th></th></tr></thead><tbody>'+teachers.map(function(a,i){const q=a.permissions||{};return '<tr data-perm-id="'+escapeHtml(a.id)+'"><td><b>'+escapeHtml(a.name||a.id)+'</b><br><small>'+escapeHtml(a.id)+'</small></td><td><input type="checkbox" data-perm="calendar" '+(q.calendar?'checked':'')+'></td><td><input type="checkbox" data-perm="notice" '+(q.notice?'checked':'')+'></td><td><input type="checkbox" data-perm="duty" '+(q.duty?'checked':'')+'></td><td><button class="btn" data-save-perm="'+i+'" type="button">저장</button></td></tr>';}).join('')+'</tbody></table></div><div id="permissions-status" class="settings-message"></div></article>';
    root.querySelectorAll('[data-save-perm]').forEach(function(button){button.onclick=async function(){const tr=button.closest('tr'),status=document.getElementById('permissions-status'),permissions={};tr.querySelectorAll('[data-perm]').forEach(function(x){permissions[x.dataset.perm]=x.checked;});button.disabled=true;status.className='settings-message';status.textContent='권한을 저장 중입니다...';const result=await postApp({action:'permissionUpdate',targetId:tr.dataset.permId,permissions:permissions,loginId:currentAccountId,password:currentLoginPassword});button.disabled=false;if(result.success){status.className='settings-message ok';status.textContent='권한을 저장했습니다. 해당 교사가 다음 로그인 또는 새로고침 후 적용됩니다.';}else{status.className='settings-message err';status.textContent=result.error||'권한을 저장하지 못했습니다.';}};});
  }
  function showAlerts(){
    const p=preferences(); const message=[];const today=new Date();const dow=today.getDay()-1;
    if(p.dutyAlert&&dow>=0&&dow<=4){const g=weeklyDutyRotation.activeGroup,rows=g?(weeklyDutyRotation.groups[g]||[]):[];const names=rows.map(function(r){return (r.days||[])[dow]||'';}).filter(function(name){return String(name).replace(/\s/g,'').includes(String(currentUser||'').replace(/\s/g,''));});if(names.length)message.push('오늘은 '+g+'조 급식 당번입니다.');}
    if(p.calendarAlert){const todays=(events||[]).filter(function(ev){const d=parseDateFlexible(ev.date);return d&&dateKey(d)===dateKey(today);});if(todays.length)message.push('오늘 학사일정: '+todays.map(function(x){return x.title||x.detail;}).join(', '));}
    if(p.noticeAlert){const live=(notices||[]).filter(function(n){return (!n.start||stripTime(n.start)<=stripTime(today))&&(!n.end||stripTime(n.end)>=stripTime(today));});if(live.length)message.push('현재 담임 전달사항 '+live.length+'건이 있습니다.');}
    const key='gijang_login_alert_seen::'+(currentAccountId||'')+'::'+dateKey(today);if(message.length&&!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');setTimeout(function(){alert(message.join('\n'));},350);}
  }
  function updateMasterPermissionTab(){const tab=document.getElementById('permissions-tab-btn');if(tab)tab.style.display=isMasterUser()?'':'none';}
  establishLogin_=function(account,pw){originalEstablishLogin(account,pw);setTimeout(function(){updateMasterPermissionTab();renderSettings();showAlerts();},250);};
  openDayModal=function(date,evs,holiday){originalOpenDayModal(date,evs,holiday);if(!permissionFor('calendar'))return;const body=document.getElementById('day-modal-body');let eventIndex=0;body.querySelectorAll('.event-row').forEach(function(row){if(row.querySelector('.holiday-title'))return;const ev=evs[eventIndex++];if(!ev||!ev.row||row.querySelector('.member-actions'))return;const actions=document.createElement('div');actions.className='member-actions';actions.style.marginTop='8px';const edit=document.createElement('button');edit.className='btn';edit.textContent='수정';edit.onclick=function(){startCalendarEdit(ev,date);};const del=document.createElement('button');del.className='btn danger';del.textContent='삭제';del.onclick=function(){deleteDashboardRow('학사일정',ev.row,'학사일정');};actions.append(edit,del);row.appendChild(actions);});};
  renderNotices=function(){
    originalRenderNotices();
    if(!permissionFor('notice'))return;
    const today=stripTime(new Date());
    ['1','2','3'].forEach(function(g){
      const forThisGrade=(notices||[]).filter(function(n){return (!n.start||today>=stripTime(n.start))&&(!n.end||today<=stripTime(n.end))&&(n.grade==='all'||n.grade===g);}).sort(function(a,b){return (a.end?a.end.getTime():Infinity)-(b.end?b.end.getTime():Infinity);});
      const items=document.querySelectorAll('#notice-col-'+g+' .notice-item');
      items.forEach(function(div,index){const n=forThisGrade[index];if(!n||!n.row||div.querySelector('.member-actions'))return;const actions=document.createElement('div');actions.className='member-actions';actions.style.marginTop='7px';const edit=document.createElement('button');edit.className='btn';edit.textContent='수정';edit.onclick=function(){startNoticeEdit(n);};const del=document.createElement('button');del.className='btn danger';del.textContent='삭제';del.onclick=function(){deleteDashboardRow('담임교사 전달사항',n.row,'안내사항');};actions.append(edit,del);div.appendChild(actions);});
    });
  };
  loadAll=async function(){const result=await originalLoadAll();if(currentAccountId){updateMasterPermissionTab();renderSettings();showAlerts();}return result;};
  document.addEventListener('DOMContentLoaded',function(){
    const originalButton=document.getElementById('weekly-duty-sheet-open-btn');
    if(originalButton){
      const button=originalButton.cloneNode(true); originalButton.replaceWith(button);
      button.textContent='+ 급식 당번 수정';
      button.addEventListener('click',toggleDutyEditor);
    }
    document.getElementById('personal-settings-btn')?.addEventListener('click',openPersonalSettings);
    updateMasterPermissionTab();
    updateDashboardEditControls();
  });
  injectCss();injectSettings();
})();
