/* MedShift 1.0 — single-user, offline-first personal shift calendar. */
(() => {
  'use strict';
  const KEY='medshift.private.v1';
  const $=id=>document.getElementById(id);
  const main=$('main');
  const today=new Date();
  const isoLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const NOW=isoLocal(today);
  const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pad=n=>String(n).padStart(2,'0');
  const parseISO=s=>new Date(`${s}T12:00:00`);
  const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(parseISO(s).getTime())&&isoLocal(parseISO(s))===s;
  const validTime=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const dateFmt=(s,options={weekday:'long',day:'numeric',month:'long'})=>new Intl.DateTimeFormat('it-IT',options).format(parseISO(s));
  const TYPES={morning:{name:'Mattina',emoji:'☀',from:'07:00',to:'14:00',cl:'green'},afternoon:{name:'Pomeriggio',emoji:'◴',from:'14:00',to:'21:00',cl:'orange'},night:{name:'Notte',emoji:'☾',from:'20:00',to:'07:00',cl:'purple'},oncall:{name:'Reperibilità',emoji:'♧',from:'08:00',to:'20:00',cl:'orange'},off:{name:'Riposo',emoji:'☕',from:'',to:'',cl:'gray'},leave:{name:'Ferie',emoji:'☼',from:'',to:'',cl:'green'},training:{name:'Formazione',emoji:'✧',from:'09:00',to:'13:00',cl:'purple'}};
  const fresh=()=>({version:1,name:'Matteo',department:'Laboratorio Analisi',monthlyGoal:160,shifts:[]});
  function validateShift(s){
    if(!s||typeof s!=='object'||typeof s.id!=='string'||!validDate(s.date)||!TYPES[s.type]||typeof s.dept!=='string'||typeof s.note!=='string'||s.dept.length>120||s.note.length>1000)return false;
    if(['off','leave'].includes(s.type))return s.start===''&&s.end===''&&s.breakMinutes===0;
    return validTime(s.start)&&validTime(s.end)&&s.start!==s.end&&Number.isInteger(s.breakMinutes)&&s.breakMinutes>=0&&s.breakMinutes<=600&&s.breakMinutes<shiftDuration(s);
  }
  function validateData(x){return x&&x.version===1&&typeof x.name==='string'&&x.name.length<=80&&typeof x.department==='string'&&x.department.length<=120&&Number.isFinite(x.monthlyGoal)&&x.monthlyGoal>=1&&x.monthlyGoal<=400&&Array.isArray(x.shifts)&&x.shifts.length<=10000&&x.shifts.every(validateShift)&&new Set(x.shifts.map(s=>s.id)).size===x.shifts.length}
  let data=fresh(); let startupWarning='';
  try{let raw=localStorage.getItem(KEY);if(raw){let x=JSON.parse(raw);if(validateData(x))data=x;else startupWarning='I dati salvati non sono leggibili: esporta un backup prima di continuare.'}}catch(e){startupWarning='Salvataggio locale non disponibile: non fare affidamento sulla conservazione dei dati in questa sessione.'}
  const state={tab:'home',selected:NOW,month:today.getMonth(),year:today.getFullYear(),filter:'month',edit:null,notice:startupWarning};
  function save(){try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch(e){notify('Salvataggio non riuscito: esporta subito un backup.');return false}}
  function notify(message){state.notice=message;render();const t=$('toast');t.textContent=message;t.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>{t.hidden=true},3200)}
  function sorted(){return [...data.shifts].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start))}
  function shiftDuration(s){if(!s.start||!s.end)return 0;let [a,b]=s.start.split(':').map(Number),[c,d]=s.end.split(':').map(Number);return ((c*60+d-a*60-b+1440)%1440)}
  function shiftHours(s){return ['morning','afternoon','night'].includes(s.type)?Math.max(0,shiftDuration(s)-s.breakMinutes)/60:0}
  function fmtHours(n){return new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(n)}
  function fromMonth(s){return s.date.slice(0,7)===`${state.year}-${pad(state.month+1)}`}
  function monthShifts(){return data.shifts.filter(fromMonth)}
  function isPastOrFuture(s){return s.date>=NOW}
  function badge(s){return `<span class="badge ${TYPES[s.type].cl}">${TYPES[s.type].name}</span>`}
  function section(title,action,act){return `<div class="section-head"><h2>${title}</h2>${action?`<button class="link" data-action="${act}">${action} ›</button>`:''}</div>`}
  function quick(title,caption,icon,act,cl=''){return `<button class="action ${cl}" data-action="${act}"><span style="font-size:23px">${icon}</span><b>${title}</b><span>${caption}</span></button>`}
  function shiftCard(s){let t=TYPES[s.type];return `<button class="taprow row" data-action="detail" data-id="${safe(s.id)}"><div class="iconbox ${t.cl}">${t.emoji}</div><div class="grow"><div class="row between" style="flex-wrap:wrap;gap:5px"><span class="shiftname">${t.name}</span>${badge(s)}</div><div class="details">▦ ${dateFmt(s.date)}${s.start?`<br>◷ ${s.start} – ${s.end}${s.end<=s.start?' (+1 giorno)':''}`:''}${s.dept?`<br>⌖ ${safe(s.dept)}`:''}</div></div><span class="chevron">›</span></button>`}
  function empty(icon,text,action,act){return `<div class="empty"><div class="big">${icon}</div><div class="small muted">${text}</div>${action?`<button style="margin-top:13px" class="secondary" data-action="${act}">${action}</button>`:''}</div>`}
  function monthTitle(){return dateFmt(`${state.year}-${pad(state.month+1)}-01`,{month:'long',year:'numeric'})}
  function setView(tab){state.tab=tab;render();window.scrollTo({top:0,behavior:'instant'})}
  function headerIntro(title,desc){return `<h1>${title}</h1><p class="intro">${desc}</p>`}
  function home(){
    const next=sorted().find(s=>isPastOrFuture(s)&&!['off','leave'].includes(s.type));const month=monthShifts();const h=month.reduce((n,s)=>n+shiftHours(s),0);const pc=Math.min(100,h/data.monthlyGoal*100);
    return `<div class="row" style="margin-bottom:18px"><div class="avatar">${safe((data.name||'M').slice(0,2).toUpperCase())}</div><div class="grow"><h1 style="font-size:19px">Ciao, ${safe(data.name||'Matteo')}! 👋</h1><p class="intro" style="margin:0">La tua giornata, a colpo d'occhio.</p></div></div>
      <div class="card bluecard"><div class="row between"><div class="row"><div class="iconbox">▦</div><h3>Prossimo impegno</h3></div>${next?badge(next):''}</div>${next?`<div style="font-size:18px;font-weight:800;margin:13px 0 7px">${TYPES[next.type].name}</div><div class="small">${safe(next.dept||data.department)}<br><span class="muted">▦ ${dateFmt(next.date)}${next.start?`<br>◷ ${next.start} – ${next.end}`:''}</span></div><button class="link" data-action="detail" data-id="${safe(next.id)}" style="margin-top:6px">Apri dettaglio ›</button>`:`<p class="intro" style="margin-top:13px">Nessun turno futuro registrato.</p><button class="secondary" data-action="add">＋ Inserisci il primo turno</button>`}</div>
      <div class="metrics" style="margin-top:10px"><div class="card greencard"><div class="small muted">Ore del mese</div><div class="value">${fmtHours(h)} <span class="small muted">h</span></div><div class="bar"><i style="width:${pc}%"></i></div><div class="tiny muted" style="margin-top:5px">Obiettivo ${data.monthlyGoal} h</div></div><div class="card purplecard"><div class="small muted">Reperibilità</div><div class="value">${month.filter(s=>s.type==='oncall').length}</div><div class="tiny muted" style="margin-top:8px">Nel mese selezionato</div></div></div>
      ${section('Azioni rapide')}
      <div class="actions">${quick('Aggiungi turno','Inserimento manuale','＋','add')}${quick('Calendario','Visualizza il mese','▦','calendar','green')}${quick('Statistiche','Ore e attività','▥','stats','purple')}${quick('Backup dati','Esporta un file JSON','⇩','export','orange')}</div>
      ${section('I prossimi turni','Vedi tutti','shifts')}<div class="stack">${sorted().filter(s=>s.date>=NOW&&s.type!=='off').slice(0,3).map(shiftCard).join('')||empty('▦','Non hai impegni futuri.','Aggiungi un turno','add')}</div>`;
  }
  function shiftsView(){
    let arr=sorted();if(state.filter==='month')arr=arr.filter(fromMonth);if(state.filter==='upcoming')arr=arr.filter(isPastOrFuture);if(state.filter==='all')arr=arr;
    return `${headerIntro('I miei turni','Aggiungi, modifica ed elimina le tue attività.')}
    <div class="chip-row"><button data-filter="month" class="${state.filter==='month'?'selected':''}">Questo mese</button><button data-filter="upcoming" class="${state.filter==='upcoming'?'selected':''}">Futuri</button><button data-filter="all" class="${state.filter==='all'?'selected':''}">Tutti</button></div>
    <div class="stack">${arr.map(shiftCard).join('')||empty('▤','Nessun turno in questo periodo.','Inserisci un turno','add')}</div>
    <div style="height:13px"></div><button class="primary full" data-action="add">＋ Aggiungi turno</button>`;
  }
  function calendar(){
    let first=new Date(state.year,state.month,1),total=new Date(state.year,state.month+1,0).getDate(),offset=(first.getDay()+6)%7,days=Array.from({length:offset},()=>'<span class="day blank"></span>');
    for(let i=1;i<=total;i++){let d=`${state.year}-${pad(state.month+1)}-${pad(i)}`,items=data.shifts.filter(s=>s.date===d);days.push(`<button class="day ${d===state.selected?'current':''}" data-day="${d}" aria-label="${safe(dateFmt(d))}" aria-pressed="${d===state.selected}">${i}<span class="dots">${items.slice(0,3).map(s=>`<i class="dot ${s.type}"></i>`).join('')}</span></button>`)}
    let selected=data.shifts.filter(s=>s.date===state.selected);
    return `${headerIntro('Calendario','Seleziona una data per consultare o aggiungere un turno.')}
      <div class="card"><div class="row between" style="margin-bottom:12px"><button class="secondary" data-action="prev-month" aria-label="Mese precedente">‹</button><strong style="text-transform:capitalize;font-size:13px">${monthTitle()}</strong><button class="secondary" data-action="next-month" aria-label="Mese successivo">›</button></div>
      <div class="calendar-grid">${['L','M','M','G','V','S','D'].map(d=>`<span class="weekday">${d}</span>`).join('')}${days.join('')}</div><div class="legend">${['morning','afternoon','night','oncall','leave','training'].map(k=>`<span><i class="dot ${k}"></i>${TYPES[k].name}</span>`).join('')}</div></div>
      ${section('Dettaglio giornata')}<p class="intro" style="text-transform:capitalize;margin-top:-6px">${dateFmt(state.selected,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
      <div class="stack">${selected.map(shiftCard).join('')||empty('☕','Nessuna attività per questo giorno.')}</div><div style="height:12px"></div><button class="primary full" data-action="add-selected">＋ Aggiungi turno per questa data</button>`;
  }
  function stats(){
    let a=monthShifts(),work=a.filter(s=>shiftHours(s)>0),h=work.reduce((n,s)=>n+shiftHours(s),0),pc=Math.min(100,100*h/data.monthlyGoal);
    let weeks=[0,0,0,0,0];for(let s of work){let w=Math.min(4,Math.floor((Number(s.date.slice(8))-1)/7));weeks[w]+=shiftHours(s)}let max=Math.max(1,...weeks);
    return `${headerIntro('Statistiche',`Riepilogo di ${monthTitle()} · ore calcolate dai turni salvati.`)}
      <div class="metrics"><div class="card bluecard"><div class="small muted">Ore lavorate</div><div class="value">${fmtHours(h)} <span class="small">h</span></div></div><div class="card purplecard"><div class="small muted">Turni notturni</div><div class="value">${a.filter(s=>s.type==='night').length}</div></div><div class="card orangecard"><div class="small muted">Reperibilità</div><div class="value">${a.filter(s=>s.type==='oncall').length}</div></div><div class="card greencard"><div class="small muted">Turni lavorati</div><div class="value">${work.length}</div></div></div>
      <div class="card" style="margin-top:10px"><div class="row between"><h3>Ore settimanali</h3><span class="small muted">${fmtHours(h)} h totali</span></div><div class="chart">${weeks.map((v,i)=>`<div class="barcol">${v?fmtHours(v):''}<i style="height:${Math.max(2,100*v/max)}%"></i><small>Sett. ${i+1}</small></div>`).join('')}</div></div>
      <div class="card" style="margin-top:10px"><div class="row between"><h3>Obiettivo mensile</h3><strong>${Math.round(pc)}%</strong></div><div class="bar"><i style="width:${pc}%"></i></div><p class="description" style="margin:9px 0 0">${fmtHours(h)} ore registrate su ${data.monthlyGoal} ore impostate. Le reperibilità e le pause non contano nelle ore lavorate.</p></div>
      ${section('Altre attività')}<div class="card stack">${['morning','afternoon','night','oncall','off','leave','training'].map(k=>`<div class="row between"><span class="small">${TYPES[k].emoji} ${TYPES[k].name}</span><strong>${a.filter(s=>s.type===k).length}</strong></div>`).join('')}</div>`;
  }
  function profile(){return `${headerIntro('Profilo','Personalizza MedShift e gestisci i tuoi dati.')}
    <form id="profile-form" class="card"><label class="field">Nome visualizzato<input name="name" maxlength="80" required value="${safe(data.name)}"></label><label class="field">Reparto / Unità operativa<input name="department" maxlength="120" required value="${safe(data.department)}"></label><label class="field">Obiettivo ore mensili<input name="monthlyGoal" type="number" min="1" max="400" step="1" required value="${data.monthlyGoal}"></label><button class="primary full" type="submit">Salva preferenze</button></form>
    ${section('Backup e ripristino')}
    <div class="card stack"><p class="description">I tuoi dati sono salvati solo nel browser di questo dispositivo. Salva periodicamente una copia JSON nell'app File; potrai ripristinarla anche dopo un cambio di iPhone.</p><button class="secondary full" data-action="export">⇩ Esporta backup JSON</button><label class="secondary full file-label">⇧ Ripristina da backup JSON<input type="file" id="backup-file" accept=".json,application/json"></label><p class="description">Il ripristino sostituisce tutti i turni e le preferenze attuali, dopo una conferma.</p></div>
    ${section('Dati dimostrativi')}<div class="card stack"><p class="description">Carica un esempio di calendario per esplorare MedShift. Non aggiungere turni dimostrativi al tuo calendario reale.</p><button class="secondary full" data-action="demo">Carica un mese di esempio</button><button class="danger full" data-action="erase">Elimina tutti i dati locali</button></div>
    <p class="description" style="margin-top:18px">MedShift 1.0 · App personale offline. Nessun account, sincronizzazione cloud o notifiche automatiche. Non inserire dati identificativi dei pazienti.</p>`}
  function form(){
    const isEdit=state.edit!==null;let s=isEdit?data.shifts.find(x=>x.id===state.edit):null;
    if(isEdit&&!s){setView('shifts');return ''}
    s=s||{date:state.selected||NOW,type:'morning',start:'07:00',end:'14:00',dept:data.department,note:'',breakMinutes:0};
    return `${headerIntro(isEdit?'Modifica turno':'Nuovo turno','Inserisci i dettagli del tuo impegno. Le modifiche vengono salvate su questo dispositivo.')}
    <form id="shift-form" class="card"><label class="field">Data<input type="date" name="date" required value="${safe(s.date)}"></label>
      <label class="field">Tipologia<select name="type" id="shift-type">${Object.entries(TYPES).map(([k,t])=>`<option value="${k}" ${s.type===k?'selected':''}>${t.name}</option>`).join('')}</select></label>
      <div id="time-fields" ${['off','leave'].includes(s.type)?'hidden':''}><div class="two"><label class="field">Dalle<input type="time" name="start" value="${safe(s.start||'07:00')}"></label><label class="field">Alle<input type="time" name="end" value="${safe(s.end||'14:00')}"></label></div><label class="field">Pausa non lavorata (minuti)<input type="number" name="breakMinutes" min="0" max="600" step="1" value="${s.breakMinutes}"><span class="field-help">Sottratta solo dalle ore lavorate; le reperibilità non vengono conteggiate come ore lavorate.</span></label><p class="field-help" style="margin:-6px 0 13px">Se l'orario di fine è precedente all'inizio, il turno termina il giorno successivo.</p></div>
      <label class="field">Reparto / luogo<input name="dept" maxlength="120" value="${safe(s.dept)}" placeholder="Laboratorio Analisi"></label>
      <label class="field">Note (facoltative)<textarea name="note" maxlength="1000" placeholder="Promemoria personali, senza dati dei pazienti">${safe(s.note)}</textarea></label>
      <div id="form-error" class="notice" role="alert" hidden></div><div class="form-buttons"><button type="submit" class="primary full">${isEdit?'Salva modifiche':'Aggiungi turno'}</button><button type="button" class="secondary full" data-action="cancel">Annulla</button></div></form>`;
  }
  function detail(){let s=data.shifts.find(x=>x.id===state.edit);if(!s){state.edit=null;return shiftsView()}
    return `${headerIntro('Dettaglio turno',dateFmt(s.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}
      <div class="card bluecard stack"><div class="row between"><div class="row"><div class="iconbox ${TYPES[s.type].cl}">${TYPES[s.type].emoji}</div><h3 style="font-size:17px;margin:0">${TYPES[s.type].name}</h3></div>${badge(s)}</div><div class="divider"></div><div class="small">⌖ ${safe(s.dept||'Nessun reparto specificato')}</div>${s.start?`<div class="small">◷ ${s.start} – ${s.end}${s.end<=s.start?' (+1 giorno)':''}</div><div class="small muted">Pausa: ${s.breakMinutes} min${shiftHours(s)?` · Ore lavorate: ${fmtHours(shiftHours(s))} h`:''}</div>`:''}${s.note?`<div class="divider"></div><div class="small" style="white-space:pre-wrap;overflow-wrap:anywhere">${safe(s.note)}</div>`:''}</div>
      <div class="stack" style="margin-top:14px"><button class="primary full" data-action="edit" data-id="${safe(s.id)}">✎ Modifica turno</button><button class="danger full" data-action="delete" data-id="${safe(s.id)}">Elimina turno</button><button class="secondary full" data-action="calendar">Torna al calendario</button></div>`;
  }
  function render(){
    document.querySelectorAll('[data-tab]').forEach(el=>{let on=el.dataset.tab===state.tab;el.classList.toggle('active',on);el.setAttribute('aria-current',on?'page':'false')});
    let html=state.tab==='home'?home():state.tab==='shifts'?shiftsView():state.tab==='calendar'?calendar():state.tab==='stats'?stats():state.tab==='profile'?profile():state.tab==='form'?form():state.tab==='detail'?detail():home();
    main.innerHTML=`<div class="view">${state.notice?`<div class="notice">${safe(state.notice)}</div>`:''}${html}</div>`;
  }
  function applyMonth(delta){let d=new Date(state.year,state.month+delta,1);state.year=d.getFullYear();state.month=d.getMonth();state.selected=isoLocal(d);render()}
  function add(date=NOW){state.selected=date;state.edit=null;setView('form')}
  function download(content,name,type){const file=new Blob([content],{type});let url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000)}
  function loadDemo(){if(data.shifts.length&&!confirm('Aggiungere i turni dimostrativi ai dati che hai già inserito?'))return;let d=new Date(state.year,state.month,1);let y=d.getFullYear(),m=d.getMonth();for(let n=1;n<=Math.min(28,new Date(y,m+1,0).getDate());n++){let day=isoLocal(new Date(y,m,n));if(data.shifts.some(s=>s.date===day))continue;let dow=new Date(y,m,n).getDay();if(dow===0||dow===6)continue;let type=n%6===0?'night':n%4===0?'afternoon':'morning',t=TYPES[type];data.shifts.push({id:'demo-'+day,date:day,type,start:t.from,end:t.to,breakMinutes:0,dept:data.department,note:''})}if(save())notify('Esempio aggiunto. Puoi eliminarne i turni quando vuoi.');setView('calendar')}
  async function importBackup(file){if(!file)return;try{
    if(file.size>3*1024*1024)throw new Error('Il file supera 3 MB.');let text=await file.text(),x=JSON.parse(text);
    if(!validateData(x))throw new Error('Il file non è un backup MedShift valido.');
    if(!confirm(`Ripristinare ${x.shifts.length} turni? Tutti i dati attualmente salvati saranno sostituiti.`))return;
    let old=data;data=x;if(!save()){data=old;return}notify(`Ripristinati ${x.shifts.length} turni.`);setView('home');
  }catch(e){notify(`Impossibile importare: ${e.message}`)}}
  document.addEventListener('click',e=>{
    const tab=e.target.closest('[data-tab]');if(tab){state.edit=null;setView(tab.dataset.tab);return}
    const day=e.target.closest('[data-day]');if(day){state.selected=day.dataset.day;render();return}
    const filter=e.target.closest('[data-filter]');if(filter){state.filter=filter.dataset.filter;render();return}
    const button=e.target.closest('[data-action]');if(!button)return;
    let act=button.dataset.action,id=button.dataset.id;state.notice='';
    switch(act){
      case 'add': add();break;
      case 'add-selected': add(state.selected);break;
      case 'cancel':setView('shifts');break;
      case 'calendar':setView('calendar');break;
      case 'shifts':setView('shifts');break;
      case 'stats':setView('stats');break;
      case 'detail':state.edit=id;setView('detail');break;
      case 'edit':state.edit=id;setView('form');break;
      case 'prev-month':applyMonth(-1);break;
      case 'next-month':applyMonth(1);break;
      case 'delete':if(confirm('Eliminare definitivamente questo turno?')){data.shifts=data.shifts.filter(s=>s.id!==id);if(save()){state.edit=null;setView('calendar');notify('Turno eliminato.')}}break;
      case 'export':download(JSON.stringify(data,null,2),`medshift-backup-${NOW}.json`,'application/json');notify('Backup creato. Conserva il file in un luogo sicuro.');break;
      case 'demo':loadDemo();break;
      case 'erase':if(confirm('Eliminare definitivamente tutti i turni e le preferenze di MedShift su questo dispositivo? Esporta prima un backup.')){data=fresh();if(save()){state.edit=null;setView('home');notify('Dati locali eliminati.')}}break;
    }
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='shift-type'){let t=TYPES[e.target.value],times=$('time-fields');times.hidden=['off','leave'].includes(e.target.value);if(t.from){let a=main.querySelector('[name=start]'),b=main.querySelector('[name=end]');a.value=t.from;b.value=t.to}return}
    if(e.target.id==='backup-file'){importBackup(e.target.files[0]);e.target.value=''}
  });
  document.addEventListener('submit',e=>{
    if(e.target.id==='profile-form'){
      e.preventDefault();let form=new FormData(e.target),name=String(form.get('name')||'').trim(),dept=String(form.get('department')||'').trim(),goal=Number(form.get('monthlyGoal'));
      if(!name||!dept||!Number.isInteger(goal)||goal<1||goal>400){notify('Controlla nome, reparto e obiettivo mensile.');return}
      data.name=name;data.department=dept;data.monthlyGoal=goal;if(save())notify('Preferenze salvate.');return;
    }
    if(e.target.id==='shift-form'){
      e.preventDefault();let f=new FormData(e.target),type=String(f.get('type')),date=String(f.get('date')),timeless=['off','leave'].includes(type),start=timeless?'':String(f.get('start')||''),end=timeless?'':String(f.get('end')||''),breakMinutes=timeless?0:Number(f.get('breakMinutes')),dept=String(f.get('dept')||'').trim(),note=String(f.get('note')||'').trim();
      let entry={id:state.edit||`ms-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,date,type,start,end,breakMinutes,dept,note};
      if(!validateShift(entry)){let box=$('form-error');box.hidden=false;box.textContent='Controlla la data, gli orari e la durata della pausa. Il turno deve avere durata positiva e la pausa deve essere inferiore al turno.';return}
      if(state.edit){let i=data.shifts.findIndex(s=>s.id===state.edit);if(i<0)return;data.shifts[i]=entry}else data.shifts.push(entry);
      if(!save())return;state.selected=date;state.year=Number(date.slice(0,4));state.month=Number(date.slice(5,7))-1;state.edit=null;setView('calendar');notify('Turno salvato sul tuo dispositivo.');
    }
  });
  render();
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
})();
