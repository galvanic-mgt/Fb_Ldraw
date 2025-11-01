import { ensureInit, listEvents, setCurrent, current, updateData } from './core.js';
import { addPrize, setCurrentPrize, prizeLeft, pickBatchAndCommit } from './stage_prizes.js';
import { exportCSV, exportWinnersCSV } from './storage_exports.js';
import { ensurePollVotes, publishPoll } from './polls_public.js';
import { applyRoleUI, restoreSession, login, ensureDefaultAdmin } from './admin_users.js';

function show(targetId){
  document.querySelectorAll('.subpage').forEach(s=>s.style.display='none');
  const sec=document.getElementById(targetId); if(sec) sec.style.display='block';
  document.querySelectorAll('#cmsNav .nav-item').forEach(b=> b.classList.toggle('active', b.dataset.target===targetId));
}
function renderEventList(){
  const list=listEvents(); const el=document.getElementById('eventList'); if(!el) return; el.innerHTML='';
  const curId = current().id;
  list.forEach(ev=>{
    const item=document.createElement('div'); item.className='event-item'+(curId===ev.id?' active':''); 
    item.innerHTML=`<div class="event-name">${ev.name}</div><div class="event-meta">ID: ${ev.id}</div>`;
    item.onclick=()=>{ setCurrent(ev.id); renderAll(); };
    el.appendChild(item);
  });
}
function bindLogin(){
  ensureDefaultAdmin();
  const gate=document.getElementById('loginGate');
  const form=document.getElementById('loginForm');
  const u=document.getElementById('loginUser');
  const p=document.getElementById('loginPass');
  const btn=document.getElementById('btnLogin');
  const me=restoreSession();
  if(me && me.username){
    applyRoleUI(me.role||'admin'); if(gate){ gate.style.display='none'; }
    return;
  }
  if(gate){ gate.style.display='flex'; }
  form?.addEventListener('submit',(e)=>{
    e.preventDefault();
    if(login((u?.value||'').trim(), (p?.value||'').trim())){
      if(gate){ gate.style.display='none'; }
      renderAll();
    }else{
      if(btn){ btn.textContent='登入失敗'; setTimeout(()=>btn.textContent='登入',1200); }
    }
  });
}
function renderEventInfo(){
  const { data } = current();
  const t=(id,val)=>{ const e=document.getElementById(id); if(e) e.value=val||''; };
  t('evTitle', data.eventInfo?.title);
  t('evClient', data.eventInfo?.client);
  t('evDateTime', data.eventInfo?.dateTime);
  t('evVenue', data.eventInfo?.venue);
  t('evAddress', data.eventInfo?.address);
  t('evMapUrl', data.eventInfo?.mapUrl);
  t('evBus', data.eventInfo?.bus);
  t('evTrain', data.eventInfo?.train);
  t('evParking', data.eventInfo?.parking);
  t('evNotes', data.eventInfo?.notes);
}
function bindEventInfoSave(){
  document.getElementById('saveEventInfo')?.addEventListener('click', ()=>{
    const g=id=>document.getElementById(id)?.value||'';
    updateData(d=>{ d.eventInfo={title:g('evTitle'),client:g('evClient'),dateTime:g('evDateTime'),venue:g('evVenue'),address:g('evAddress'),mapUrl:g('evMapUrl'),bus:g('evBus'),train:g('evTrain'),parking:g('evParking'),notes:g('evNotes')}; return d; });
    renderAll();
  });
}
function renderPrizes(){
  const { data }=current(); const tbody=document.getElementById('prizeRows'); if(!tbody) return; tbody.innerHTML='';
  (data.prizes||[]).forEach(p=>{
    const used=(p.winners||[]).length;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><input type="radio" name="curpr" ${data.currentPrizeId===p.id?'checked':''}></td><td>${p.name||''}</td><td>${p.quota||1}</td><td>${used}</td>`;
    tr.querySelector('input').onchange=()=>{ setCurrentPrize(p.id); renderPrizes(); };
    tbody.appendChild(tr);
  });
  const leftEl=document.getElementById('prizeLeftInline'); if(leftEl) leftEl.textContent = `此獎尚餘：${prizeLeft(data)}`;
}
function bindPrizeActions(){
  document.getElementById('addPrize')?.addEventListener('click', ()=>{
    const name=document.getElementById('newPrizeName')?.value.trim(); const q=Number(document.getElementById('newPrizeQuota')?.value||1);
    if(!name) return; addPrize(name,q); renderPrizes();
  });
  document.getElementById('drawBatch')?.addEventListener('click', ()=>{
    const n=Number(document.getElementById('batchCount')?.value||1);
    pickBatchAndCommit(n); renderAll();
  });
}
export function renderAll(){
  renderEventList();
  renderEventInfo();
  renderPrizes();
}
export function bootCMS(){
  ensureInit();
  bindLogin();
  document.querySelectorAll('#cmsNav .nav-item').forEach(b=> b.addEventListener('click', ()=> show(b.dataset.target)));
  bindEventInfoSave();
  bindPrizeActions();
  renderAll();
}