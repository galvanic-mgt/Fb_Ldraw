// src/ui.js
import { ensureInit, loadAll, saveAll, current, setCurrent, listEvents, updateData } from './state.js';
import { createEvent, cloneCurrentEvent, cloudUpsertEventMeta, cloudPullEventsIndexIntoLocal } from './events.js';
import { addPerson } from './roster.js';
import { addPrize, setCurrentPrize, prizeLeft } from './prizes.js';
import { drawOnce } from './stage.js';
import { addPoll, setActivePoll, publishPoll } from './poll.js';
import { FB } from './fb.js';

// QR code global from qrcode.min.js
const QR = window.QRCode;

// --- basic nav ---
function show(targetId){
  document.querySelectorAll('.subpage').forEach(s => s.style.display='none');
  const sec = document.getElementById(targetId);
  if (sec) sec.style.display = 'block';
  document.querySelectorAll('#cmsNav .nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.target === targetId);
  });
}

function renderEventList(){
  const list = listEvents();
  const el = document.getElementById('eventList');
  el.innerHTML = '';
  const all = loadAll();
  list.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'event-item' + (all.currentId===ev.id ? ' active':'');
    item.innerHTML = `<div class="event-name">${ev.name}</div><div class="event-meta">ID: ${ev.id}</div>`;
    item.onclick = () => { setCurrent(ev.id); renderAll(); };
    el.appendChild(item);
  });
}

function renderEventInfo(){
  const { data, id } = current();
  const t = (id, val) => { const e=document.getElementById(id); if(e) e.value = val || ''; };
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
  document.getElementById('saveEventInfo')?.addEventListener('click', async ()=>{
    const getV = id => document.getElementById(id)?.value || '';
    updateData(d=>{
      d.eventInfo = {
        title:getV('evTitle'), client:getV('evClient'), dateTime:getV('evDateTime'),
        venue:getV('evVenue'), address:getV('evAddress'), mapUrl:getV('evMapUrl'),
        bus:getV('evBus'), train:getV('evTrain'), parking:getV('evParking'), notes:getV('evNotes')
      };
      return d;
    });
    const { id } = current();
    await cloudUpsertEventMeta(id);
    renderAll();
  });
}

function renderPrizes(){
  const { data } = current();
  const tbody = document.getElementById('prizeRows');
  if (!tbody) return;
  tbody.innerHTML = '';
  (data.prizes||[]).forEach(p => {
    const used = (p.winners||[]).length;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="radio" name="curpr" ${data.currentPrizeId===p.id?'checked':''} /></td>
      <td>${p.name||''}</td><td>${p.quota||1}</td><td>${used}</td>
      <td><button data-act="del" class="btn danger">刪除</button></td>`;
    tr.querySelector('input').onchange = ()=>{ setCurrentPrize(p.id); renderPrizes(); };
    tr.querySelector('[data-act="del"]').onclick = ()=>{
      updateData(d=>{ d.prizes = (d.prizes||[]).filter(x=>x.id!==p.id); if(d.currentPrizeId===p.id) d.currentPrizeId=null; return d; });
      renderPrizes();
    };
    tbody.appendChild(tr);
  });
}

function bindPrizeActions(){
  document.getElementById('addPrize')?.addEventListener('click', ()=>{
    const name = document.getElementById('newPrizeName')?.value.trim();
    const q    = Number(document.getElementById('newPrizeQuota')?.value||1);
    if (!name) return;
    addPrize(name, q); renderPrizes();
  });
}

function renderStage(){
  const { data } = current();
  const grid = document.getElementById('currentBatch2') || document.getElementById('currentBatch');
  const chips= document.getElementById('winnersChips2') || document.getElementById('winnersChips');
  const titleEl = document.getElementById('publicPrize2') || document.getElementById('publicPrize');
  const cur = (data.prizes||[]).find(p=>p.id===data.currentPrizeId);
  if (titleEl) titleEl.textContent = cur ? cur.name : '—';
  if (grid) {
    grid.innerHTML = '';
    (data.currentBatch||[]).forEach(w=>{
      const card = document.createElement('div');
      card.className = 'winner-card';
      card.innerHTML = `<div class="name">${w.name}</div><div class="dept">${w.dept||''}</div>`;
      grid.appendChild(card);
    });
  }
  if (chips) {
    chips.innerHTML = '';
    (data.winners||[]).slice(-24).forEach(w=>{
      const chip = document.createElement('span'); chip.className='chip'; chip.textContent = w.name;
      chips.appendChild(chip);
    });
  }
  const remainEl = document.getElementById('statsRemain2') || document.getElementById('statsRemain');
  const winEl    = document.getElementById('statsWinners2') || document.getElementById('statsWinners');
  const leftEl   = document.getElementById('prizeLeftInline2') || document.getElementById('prizeLeftInline');
  if (remainEl) remainEl.textContent = `剩餘：${(data.remaining||[]).length}`;
  if (winEl) winEl.textContent      = `已得獎：${(data.winners||[]).length}`;
  if (leftEl) leftEl.textContent    = `此獎尚餘：${prizeLeft(data)}`;
}

function bindStage(){
  document.getElementById('draw')?.addEventListener('click', ()=>{
    const n = Number(document.getElementById('batchCount')?.value || 1);
    drawOnce(n); renderStage();
  });
}

function renderPollEditor(){
  const { data, id } = current();
  const listEl = document.getElementById('pollList');
  const optsEl = document.getElementById('pollOptions');
  const qEl    = document.getElementById('pollQ');
  if (!listEl || !optsEl || !qEl) return;

  listEl.innerHTML = '';
  (data.polls||[]).forEach(p => {
    const row = document.createElement('div');
    row.className='bar';
    row.innerHTML = `<label><input type="radio" name="pollpick" ${data.currentPollId===p.id?'checked':''}/> ${p.question||'(未命名)'}</label>`;
    row.onclick = ()=>{ setActivePoll(p.id); renderPollEditor(); };
    listEl.appendChild(row);
  });

  const cur = (data.polls||[]).find(x=>x.id===data.currentPollId);
  if (!cur) { qEl.value=''; optsEl.innerHTML=''; return; }

  qEl.value = cur.question || '';
  optsEl.innerHTML = '';
  (cur.options||[]).forEach(o=>{
    const line = document.createElement('div');
    line.className = 'bar';
    line.innerHTML = `<input data-k="text" value="${o.text||''}" />`;
    optsEl.appendChild(line);
  });
}

function bindPollEditor(){
  document.getElementById('addPoll')?.addEventListener('click', ()=>{ addPoll(); renderPollEditor(); });
  document.getElementById('savePoll')?.addEventListener('click', ()=>{
    const { data } = current();
    const cur = (data.polls||[]).find(x=>x.id===data.currentPollId);
    if (!cur) return;
    cur.question = document.getElementById('pollQ')?.value || '';
    const texts = Array.from(document.querySelectorAll('#pollOptions [data-k="text"]')).map(el=>el.value||'');
    cur.options = texts.map((t, i)=> ({ id: cur.options?.[i]?.id || ('o'+i), text:t }));
    cur.votes = {}; // reset on edit
    saveAll(loadAll());
    renderPollEditor();
  });
  document.getElementById('publishPollNow')?.addEventListener('click', async ()=>{
    const { id, data } = current();
    const cur = (data.polls||[]).find(x=>x.id===data.currentPollId);
    if (!cur) return;
    await publishPoll(id, cur);
    alert('已發佈到 Firebase');
  });
}

export function renderAll(){
  renderEventList();
  renderEventInfo();
  renderPrizes();
  renderStage();
  renderPollEditor();
}

export function bootUI(){
  ensureInit();
  // nav buttons
  document.querySelectorAll('#cmsNav .nav-item').forEach(b => {
    b.addEventListener('click', ()=> show(b.dataset.target));
  });

  // create event
  document.getElementById('addEvent')?.addEventListener('click', async ()=>{
    const name = document.getElementById('newEventName')?.value.trim();
    const client = document.getElementById('newClientName')?.value.trim();
    const id = createEvent(name, client);
    await cloudUpsertEventMeta(id);
    renderAll();
  });

  bindEventInfoSave();
  bindPrizeActions();
  bindStage();
  bindPollEditor();
  renderAll();
}