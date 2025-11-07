import { listEvents, createEvent, setCurrentEventId, getCurrentEventId, getEventInfo, saveEventInfo,
         getPeople, setPeople, getPrizes, getCurrentPrizeIdRemote, setCurrentPrizeIdRemote,
         getQuestions, setQuestions, getAssets, setAssets, getPolls, setPoll, upsertEventMeta } from './core_firebase.js';
import { addPrize, removePrize, setCurrentPrize, drawBatch } from './stage_prizes_firebase.js';
import { handleImportCSV, exportCSV } from './roster_firebase.js';
import { renderStageDraw } from './stage_draw_ui.js';

// ====== Roster table state (sorting, paging, caching) ======
const rosterState = {
  sortBy: 'name',
  sortDir: 'asc',   // 'asc' | 'desc'
  page: 1,
  pageSize: 50,
  cache: []         // last fetched people (unfiltered)
};
// ===========================================================

let bootEventsAdmin = ()=>{};
try {
  const mod = await import('./events_admin.js');
  bootEventsAdmin = mod.bootEventsAdmin;
} catch(e) {
  console.warn('events_admin.js failed to load:', e);
}
const $=(s)=>document.querySelector(s);
function show(targetId){
  document.querySelectorAll('.subpage').forEach(s=> s.style.display='none');
  const sec = document.getElementById(targetId);
  if (sec) sec.style.display = 'block';

  document.querySelectorAll('#cmsNav .nav-item')
    .forEach(b => b.classList.toggle('active', b.dataset.target === targetId));

  // If we just switched to the Lucky Draw tab, render it now (once per show)
  if (targetId === 'pageStageDraw') {
    renderStageDraw('cms');
  }
}
async function renderEventList(){
  const listRaw = await listEvents();
  // Only show events where listed !== false
  const list = (listRaw || []).filter(ev => ev.listed !== false);

  const el = $('#eventList'); if(!el) return; el.innerHTML = '';

  list.forEach(ev=>{
    const item = document.createElement('div');
    item.className = 'event-item' + (getCurrentEventId() === ev.id ? ' active' : '');
    item.innerHTML = `<div class="event-name">${ev.name}</div><div class="event-meta">ID: ${ev.id}</div>`;
    item.onclick = async ()=>{
      setCurrentEventId(ev.id);
      await renderAll();
    };
    el.appendChild(item);
  });

  // Creator stays the same
  const ad = document.createElement('div'); ad.className = 'sidebar-form';
  ad.innerHTML = `
    <input id="newEventName" placeholder="新增活動名稱" />
    <input id="newClientName" placeholder="客戶名稱" />
    <button id="btnAddEvent" class="btn primary">+ 新活動</button>`;
  el.appendChild(ad);

  ad.querySelector('#btnAddEvent').onclick = async ()=>{
    const name = ad.querySelector('#newEventName').value.trim();
    const client = ad.querySelector('#newClientName').value.trim();
    const id = await createEvent(name, client);
    setCurrentEventId(id);
    await renderAll();
  };
}
async function renderEventInfo(){const eid=getCurrentEventId();if(!eid)return;const {meta,info}=await getEventInfo(eid);const t=(id,val)=>{const e=document.getElementById(id);if(e)e.value=val||'';};t('evLabelPhone', info.labelPhone);
t('evLabelDept',  info.labelDept);
t('evTitle',info.title);t('evClient',info.client);t('evDateTime',info.dateTime);t('evVenue',info.venue);t('evAddress',info.address);t('evMapUrl',info.mapUrl);t('evBus',info.bus);t('evTrain',info.train);t('evParking',info.parking);t('evNotes',info.notes);t('metaName',meta.name);t('metaClient',meta.client);{ const el=document.getElementById('metaListed'); if(el) el.checked = meta.listed!==false; }
}
function bindEventInfoSave(){
  document.getElementById('saveEventInfo')?.addEventListener('click', async ()=>{
    const eid=getCurrentEventId(); if(!eid) return;
    const g=id=>document.getElementById(id)?.value||'';

    await saveEventInfo(eid, {
      title:g('evTitle'),
      client:g('evClient'),
      dateTime:g('evDateTime'),
      venue:g('evVenue'),
      address:g('evAddress'),
      mapUrl:g('evMapUrl'),
      bus:g('evBus'),
      train:g('evTrain'),
      parking:g('evParking'),
      notes:g('evNotes'),

      labelPhone: g('evLabelPhone'),
      labelDept:  g('evLabelDept')
    });

    await upsertEventMeta(eid, {
      name:g('metaName')||g('evTitle')||'新活動',
      client:g('metaClient'),
      listed:document.getElementById('metaListed').checked
    });

    await renderAll();
  });
}
async function renderRoster(){
  const eid = getCurrentEventId(); if(!eid) return;

  // labels
  const { info } = await getEventInfo(eid);
  const phoneLabel = info?.labelPhone || 'Phone';
  const deptLabel  = info?.labelDept  || 'Department';
  { const el=document.getElementById('hdrPhone'); if(el) el.textContent=phoneLabel; }
  { const el=document.getElementById('hdrDept');  if(el) el.textContent=deptLabel; }
  { const el=document.getElementById('thPhone');  if(el) el.textContent=phoneLabel; }
  { const el=document.getElementById('thDept');   if(el) el.textContent=deptLabel; }

  // data
  const people = await getPeople(eid);
  rosterState.cache = people;

  // filter
  const q = (document.getElementById('searchGuest')?.value || '').toLowerCase();
  let list = people.filter(p=>{
    const hay = [p.name,p.dept,p.phone,p.code,p.table,p.seat,p.prize].map(x=>(x||'').toLowerCase()).join(' ');
    return hay.includes(q);
  });

  // sort
  const { sortBy, sortDir } = rosterState;
  list.sort((a,b)=>{
    const va = (a?.[sortBy] ?? '').toString().toLowerCase();
    const vb = (b?.[sortBy] ?? '').toString().toLowerCase();
    if(va < vb) return sortDir === 'asc' ? -1 : 1;
    if(va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  // paging
  const pageSizeEl = document.getElementById('pageSize');
  if(pageSizeEl){
    rosterState.pageSize = parseInt(pageSizeEl.value,10) || 50;
  }
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / rosterState.pageSize));
  rosterState.page = Math.min(Math.max(1, rosterState.page), totalPages);
  const start = (rosterState.page - 1) * rosterState.pageSize;
  const pageSlice = list.slice(start, start + rosterState.pageSize);

  // render table
  const tbody = document.getElementById('guestTbody');
  if (tbody) tbody.innerHTML = '';

function renderRow(tr, p, idx, mode){
  if(mode === 'edit'){
    tr.innerHTML = `
      <td style="text-align:center"><input type="checkbox" ${p.checkedIn?'checked':''}></td>
      <td><input class="in name"  value="${p.name||''}"></td>
      <td><input class="in dept"  value="${p.dept||''}"></td>
      <td><input class="in phone" value="${p.phone||''}"></td>
      <td><input class="in code"  value="${p.code||''}"></td>
      <td><input class="in table" value="${p.table||''}"></td>
      <td><input class="in seat"  value="${p.seat||''}"></td>
      <td>${p.prize ? '🎁 '+p.prize : ''}</td>
      <td>
        <button class="btn small save">儲存</button>
        <button class="btn small cancel">取消</button>
      </td>
    `;
    // checkbox persists immediately
    tr.querySelector('td input[type="checkbox"]').onchange = async (e)=>{
      p.checkedIn = e.target.checked;
      await setPeople(eid, people);
    };
    tr.querySelector('.save').onclick = async ()=>{
      const v = sel => tr.querySelector(sel)?.value?.trim() || '';
      p.name  = v('.in.name');
      p.dept  = v('.in.dept');
      p.phone = v('.in.phone');
      p.code  = v('.in.code');
      p.table = v('.in.table');
      p.seat  = v('.in.seat');
      await setPeople(eid, people);
      renderRow(tr, p, idx, 'view');
    };
    tr.querySelector('.cancel').onclick = ()=> renderRow(tr, p, idx, 'view');
  } else {
    tr.innerHTML = `
      <td style="text-align:center"><input type="checkbox" ${p.checkedIn?'checked':''}></td>
      <td>${p.name || ''}</td>
      <td>${p.dept || ''}</td>
      <td>${p.phone || ''}</td>
      <td>${p.code || ''}</td>
      <td>${p.table || ''}</td>
      <td>${p.seat || ''}</td>
      <td>${p.prize ? '🎁 '+p.prize : ''}</td>
      <td>
        <button class="btn small edit">編輯</button>
      </td>
    `;
    tr.querySelector('td input[type="checkbox"]').onchange = async (e)=>{
      p.checkedIn = e.target.checked;
      await setPeople(eid, people);
    };
    tr.querySelector('.edit').onclick = ()=> renderRow(tr, p, idx, 'edit');
  }
}

pageSlice.forEach((p, iOnPage)=>{
  const tr = document.createElement('tr');
  renderRow(tr, p, start + iOnPage, 'view');
  tbody?.appendChild(tr);
});


  // counters & paging UI
  { const el=document.getElementById('rosterCount'); if(el) el.textContent = `共 ${people.length} 人`; }
  { const el=document.getElementById('pageInfo'); if(el) el.textContent = `${rosterState.page} / ${totalPages}`; }

  // enable/disable prev/next
  const prev = document.getElementById('prevPage');
  const next = document.getElementById('nextPage');
  if(prev) prev.disabled = rosterState.page <= 1;
  if(next) next.disabled = rosterState.page >= totalPages;
}

function bindRoster(){
  // Import
  document.getElementById('btnImportCSV')?.addEventListener('click', ()=>{
    const f = document.getElementById('csvFile'); if(!f?.files?.[0]) return;
    handleImportCSV(f.files[0], async ()=>{ rosterState.page=1; await renderRoster(); });
  });

  // Export
  document.getElementById('btnExportCSV')?.addEventListener('click', async ()=>{
    const csv = await exportCSV();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' }));
    a.download = 'roster.csv';
    a.click();
  });

  // Search (reset to page 1)
  document.getElementById('searchGuest')?.addEventListener('input', ()=>{
    rosterState.page = 1; renderRoster();
  });

  // Page size
  document.getElementById('pageSize')?.addEventListener('change', ()=>{
    rosterState.page = 1; renderRoster();
  });

  // Prev/Next
  document.getElementById('prevPage')?.addEventListener('click', ()=>{
    rosterState.page = Math.max(1, rosterState.page - 1); renderRoster();
  });
  document.getElementById('nextPage')?.addEventListener('click', ()=>{
    rosterState.page = rosterState.page + 1; renderRoster();
  });

  // Sort headers
  document.querySelectorAll('#guestTable thead th[data-sortable="true"]')?.forEach(th=>{
    th.addEventListener('click', ()=>{
      const key = th.getAttribute('data-key');
      if(!key) return;
      if(rosterState.sortBy === key){
        rosterState.sortDir = rosterState.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        rosterState.sortBy = key;
        rosterState.sortDir = 'asc';
      }
      // visual indicator (▲ ▼)
      document.querySelectorAll('#guestTable thead th').forEach(x=>{
        x.dataset.sort = '';
      });
      th.dataset.sort = rosterState.sortDir;
      rosterState.page = 1;
      renderRoster();
    });
  });
}

async function renderPrizes(){const eid=getCurrentEventId();if(!eid)return;const [prizes,curId]=await Promise.all([getPrizes(eid),getCurrentPrizeIdRemote(eid)]);const tbody=document.getElementById('prizeRows');tbody.innerHTML='';
  (prizes||[]).forEach(p=>{
    const used=(p.winners||[]).length;
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td><input type="radio" name="curpr" ${curId===p.id?'checked':''}></td>
      <td>${p.name||''}</td>
      <td>${p.quota||1}</td>
      <td>${used}</td>
      <td>
        <button class="btn small danger" data-del="${p.id}">刪除</button>
      </td>`;
    tr.querySelector('input').onchange = async ()=>{
      await setCurrentPrize(p.id);
      await renderPrizes();
    };
    tr.querySelector('[data-del]').onclick = async ()=>{
      const go = used>0
        ? confirm(`「${p.name||'此獎項'}」已有 ${used} 位得獎者。\n確定要刪除嗎？`)
        : confirm(`刪除「${p.name||'此獎項'}」？`);
      if(!go) return;
      await removePrize(p.id);
      await renderPrizes();
    };
    tbody.appendChild(tr);
  });
    const wins=document.getElementById('winnersList');
    wins.innerHTML='';(prizes||[]).forEach(
      p=>(p.winners||[]).forEach(w=>{
        const li=document.createElement('li');
        li.textContent=`${w.name}（${p.name}）`;
        wins.appendChild(li);}));}

document.getElementById('addPrize')?.addEventListener('click', async ()=>{
    const name = document.getElementById('newPrizeName')?.value.trim();
    const q    = Math.max(0, Number(document.getElementById('newPrizeQuota')?.value || 1));
    if (!name) return;
    await addPrize({ name, quota: q });   // <<< pass object
    document.getElementById('newPrizeName').value = '';
    document.getElementById('newPrizeQuota').value = '1';
    await renderPrizes();
  });

async function renderQuestions(){const list=await getQuestions(getCurrentEventId());const ul=document.getElementById('questionList');ul.innerHTML='';list.forEach(q=>{const li=document.createElement('li');li.textContent=q;ul.appendChild(li);});}
function bindQuestions(){document.getElementById('btnAddQuestion')?.addEventListener('click',async()=>{const eid=getCurrentEventId();const val=document.getElementById('newQuestion')?.value.trim();if(!val)return;const list=await getQuestions(eid);list.push(val);await setQuestions(eid,list);document.getElementById('newQuestion').value='';await renderQuestions();});}
async function renderAssets(){const a=await getAssets(getCurrentEventId());document.getElementById('bannerUrl').value=a.banner||'';document.getElementById('logoUrl').value=a.logo||'';const grid=document.getElementById('photosGrid');grid.innerHTML='';(a.photos||[]).forEach((url,idx)=>{const d=document.createElement('div');d.className='photo';d.innerHTML=`<img src="${url}" style="max-width:120px"><br><button data-i="${idx}" class="btn small">刪除</button>`;grid.appendChild(d);});grid.querySelectorAll('button').forEach(btn=>btn.onclick=async()=>{const i=Number(btn.dataset.i);const a2=await getAssets(getCurrentEventId());a2.photos.splice(i,1);await setAssets(getCurrentEventId(),a2);await renderAssets();});}
function bindAssets(){document.getElementById('saveAssets')?.addEventListener('click',async()=>{const eid=getCurrentEventId();const banner=document.getElementById('bannerUrl').value.trim();const logo=document.getElementById('logoUrl').value.trim();const cur=await getAssets(eid);await setAssets(eid,{...cur,banner,logo});await renderAssets();});document.getElementById('addPhoto')?.addEventListener('click',async()=>{const eid=getCurrentEventId();const url=prompt('貼上相片 URL');if(!url)return;const cur=await getAssets(eid);cur.photos=cur.photos||[];cur.photos.push(url.trim());await setAssets(eid,cur);await renderAssets();});}
async function renderPolls(){const polls=await getPolls(getCurrentEventId());const list=document.getElementById('pollList');list.innerHTML='';Object.values(polls||{}).forEach(p=>{const li=document.createElement('li');const total=Object.values(p.votes||{}).reduce((a,b)=>a+Number(b||0),0);li.innerHTML=`<strong>${p.question}</strong> <small>(共 ${total} 票)</small>`;list.appendChild(li);});}
function bindPolls(){document.getElementById('btnAddPoll')?.addEventListener('click',async()=>{const eid=getCurrentEventId();const q=document.getElementById('newPollQ').value.trim();const raw=document.getElementById('newPollOpts').value.trim();if(!q||!raw)return;const options=raw.split(/\n|,/).map(s=>s.trim()).filter(Boolean).map((t,i)=>({id:'o'+(i+1),text:t}));const poll={id:'poll'+Date.now().toString(36),question:q,options,votes:{}};await setPoll(eid,poll);document.getElementById('newPollQ').value='';document.getElementById('newPollOpts').value='';await renderPolls();});}
function bindPrizeActions(){
  // 新增獎品
  document.getElementById('addPrize')?.addEventListener('click', async ()=>{
    const nameEl = document.getElementById('newPrizeName');
    const quotaEl = document.getElementById('newPrizeQuota');
    const name = nameEl?.value.trim();
    const q    = Math.max(0, Number(quotaEl?.value || 1));
    if (!name) return;
    await addPrize({ name, quota: q });
    if (nameEl)  nameEl.value = '';
    if (quotaEl) quotaEl.value = '1';
    await renderPrizes();
  });

  // （可選）批量抽出 on 獎品頁的 “抽出” 按鈕，如果你要它生效就保留
  document.getElementById('drawBatch')?.addEventListener('click', async ()=>{
    const cnt = Math.max(1, Number(document.getElementById('batchCount')?.value || 1));
    await drawBatch(cnt);
    await renderPrizes();
  });
}

export async function renderAll(){await renderEventList();await renderEventInfo();await renderRoster();await renderPrizes();await renderQuestions();await renderAssets();await renderPolls();}
export async function bootCMS(){const u=new URL(location.href);const eid=u.searchParams.get('event');const list=await listEvents();if(eid&&list.some(e=>e.id===eid))setCurrentEventId(eid);else if(list[0])setCurrentEventId(list[0].id);document.querySelectorAll('#cmsNav .nav-item').forEach(b=> b.addEventListener('click',()=> show(b.dataset.target)));bindEventInfoSave();bindRoster();bindPrizeActions();bindQuestions();bindAssets();bindPolls();bootEventsAdmin();await renderAll();}
// Let other modules (like events_admin) trigger a full UI refresh
window.refreshCMS = renderAll;
