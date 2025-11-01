import { listEvents, createEvent, setCurrentEventId, getCurrentEventId, getEventInfo, saveEventInfo,
         getPrizes, getCurrentPrizeIdRemote } from './core_firebase.js';
import { addPrize, setCurrentPrize, drawBatch } from './stage_prizes_firebase.js';
import { handleImportCSV, loadRoster } from './roster_firebase.js';
import { bindLoginOverlay } from './admin_overlay.js';
const $=(s)=>document.querySelector(s);
function show(targetId){ document.querySelectorAll('.subpage').forEach(s=>s.style.display='none'); const sec=document.getElementById(targetId); if(sec) sec.style.display='block'; document.querySelectorAll('#cmsNav .nav-item').forEach(b=> b.classList.toggle('active', b.dataset.target===targetId)); }
async function renderEventList(){
  const list=await listEvents(); const el=$('#eventList'); if(!el) return; el.innerHTML='';
  list.forEach(ev=>{ const item=document.createElement('div'); item.className='event-item'+(getCurrentEventId()===ev.id?' active':''); item.innerHTML=`<div class="event-name">${ev.name}</div><div class="event-meta">ID: ${ev.id}</div>`; item.onclick=async()=>{ setCurrentEventId(ev.id); await renderAll(); }; el.appendChild(item); });
  const ad=document.createElement('div'); ad.className='sidebar-form'; ad.innerHTML=`<input id="newEventName" placeholder="新增活動名稱" /><input id="newClientName" placeholder="客戶名稱" /><button id="btnAddEvent" class="btn primary">+ 新活動</button>`; el.appendChild(ad);
  ad.querySelector('#btnAddEvent').onclick=async()=>{ const name=ad.querySelector('#newEventName').value.trim(); const client=ad.querySelector('#newClientName').value.trim(); const id=await createEvent(name,client); setCurrentEventId(id); await renderAll(); };
}
async function renderEventInfo(){
  const eid=getCurrentEventId(); if(!eid) return; const {info}=await getEventInfo(eid);
  const t=(id,val)=>{ const e=document.getElementById(id); if(e) e.value=val||''; };
  t('evTitle', info.title); t('evClient', info.client); t('evDateTime', info.dateTime); t('evVenue', info.venue); t('evAddress', info.address); t('evMapUrl', info.mapUrl); t('evBus', info.bus); t('evTrain', info.train); t('evParking', info.parking); t('evNotes', info.notes);
}
function bindEventInfoSave(){
  $('#saveEventInfo')?.addEventListener('click', async ()=>{
    const eid=getCurrentEventId(); if(!eid) return;
    const g=id=>document.getElementById(id)?.value||'';
    await saveEventInfo(eid,{title:g('evTitle'),client:g('evClient'),dateTime:g('evDateTime'),venue:g('evVenue'),address:g('evAddress'),mapUrl:g('evMapUrl'),bus:g('evBus'),train:g('evTrain'),parking:g('evParking'),notes:g('evNotes')});
    await renderAll();
  });
}
async function renderPrizes(){
  const eid=getCurrentEventId(); if(!eid) return;
  const [prizes, curId] = await Promise.all([ getPrizes(eid), getCurrentPrizeIdRemote(eid) ]);
  const tbody = document.getElementById('prizeRows'); if(!tbody) return; tbody.innerHTML='';
  (prizes||[]).forEach(p=>{ const used=(p.winners||[]).length; const tr=document.createElement('tr'); tr.innerHTML=`<td><input type="radio" name="curpr" ${curId===p.id?'checked':''}></td><td>${p.name||''}</td><td>${p.quota||1}</td><td>${used}</td>`; tr.querySelector('input').onchange=async()=>{ await setCurrentPrize(p.id); await renderPrizes(); }; tbody.appendChild(tr); });
}
function bindPrizeActions(){
  document.getElementById('addPrize')?.addEventListener('click', async ()=>{ const name=document.getElementById('newPrizeName')?.value.trim(); const q=Number(document.getElementById('newPrizeQuota')?.value||1); if(!name) return; await addPrize(name,q); await renderPrizes(); });
  document.getElementById('drawBatch')?.addEventListener('click', async ()=>{ const n=Number(document.getElementById('batchCount')?.value||1); await drawBatch(n); await renderPrizes(); });
}
function bindRoster(){
  document.getElementById('btnImportCSV')?.addEventListener('click', ()=>{ const f=document.getElementById('csvFile'); if(!f?.files?.[0]) return; handleImportCSV(f.files[0], async ()=>{ const list=await loadRoster(); document.getElementById('guestList').textContent=`名單 ${list.length} 人`; }); });
  document.getElementById('btnExportCSV')?.addEventListener('click', async ()=>{ const list=await loadRoster(); const rows=[['Name','Dept','CheckedIn','Table','Seat'], ...list.map(p=>[p.name,p.dept||'',p.checkedIn?1:0,p.table||'',p.seat||''])]; const csv=rows.map(r=> r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='roster.csv'; a.click(); });
}
export async function renderAll(){ await renderEventList(); await renderEventInfo(); await renderPrizes(); }
export async function bootCMS(){
  bindLoginOverlay();
  const u=new URL(location.href); const eid=u.searchParams.get('event'); const list=await listEvents(); if(eid && list.some(e=>e.id===eid)) setCurrentEventId(eid); else if(list[0]) setCurrentEventId(list[0].id);
  document.querySelectorAll('#cmsNav .nav-item').forEach(b=> b.addEventListener('click', ()=> show(b.dataset.target)));
  bindEventInfoSave(); bindPrizeActions(); bindRoster();
  await renderAll();
}