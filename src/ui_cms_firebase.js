import { listEvents, createEvent, setCurrentEventId, getCurrentEventId, getEventInfo, saveEventInfo,
         getPeople, setPeople, getPrizes, getCurrentPrizeIdRemote, setCurrentPrizeIdRemote,
         getQuestions, setQuestions, getAssets, setAssets, getPolls, setPoll, upsertEventMeta } from './core_firebase.js';
import { addPrize, removePrize, setCurrentPrize, drawBatch } from './stage_prizes_firebase.js';
import { handleImportCSV, exportCSV } from './roster_firebase.js';
import { renderStageDraw } from './stage_draw_ui.js';
import { FB } from './fb.js';

(function(){
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  // Load saved theme
  const saved = localStorage.getItem('cms-theme') || 'dark';
  document.body.classList.toggle('theme-light', saved === 'light');
  updateButton();

  btn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('theme-light');
    localStorage.setItem('cms-theme', isLight ? 'light' : 'dark');
    updateButton();
  });

  function updateButton(){
    const isLight = document.body.classList.contains('theme-light');
    btn.textContent = isLight ? '🌙 Dark Mode' : '☀️ Normal Mode';
  }
})();


// --- Helpers (IDs / links / QR / chips) ---
function makeId(prefix='p'){ return prefix + Math.random().toString(36).slice(2,8); }

// --- Current-poll helpers (non-destructive additions) ---
function linkTo(file, eid, pid){
  const u = new URL(location.href);
  u.pathname = (u.pathname.replace(/[^/]+$/, '') || '/') + file;
  u.search = `?event=${encodeURIComponent(eid)}&poll=${encodeURIComponent(pid)}`;
  return u.href;
}

async function setCurrentPoll(eid, pid){
  // Store the current poll id under /events/{eid}/ui so public page can follow
  return window.FB?.patch?.(`/events/${eid}/ui`, { currentPollId: pid, showPollQR: true });
}

function ensureQR(link){
  const host = document.getElementById('pollQR');
  if (!host) return;
  host.innerHTML = `
    <div class="grid-2" style="gap:16px;align-items:center">
      <div id="pollQRCanvas"></div>
      <div>
        <div class="muted" style="word-break:break-all">${link}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <button id="copyVoteLink" class="btn">複製投票連結</button>
          <a class="btn" href="${link}" target="_blank" rel="noopener">開啟投票頁</a>
        </div>
      </div>
    </div>
  `;
  if (window.QRCode && document.getElementById('pollQRCanvas')) {
    // eslint-disable-next-line no-undef
    new QRCode(document.getElementById('pollQRCanvas'), {
      text: link, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.M
    });
  }
  document.getElementById('copyVoteLink')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); alert('已複製投票連結'); } catch(e){}
  });
}

function ensureLandingQR(eid) {
  if (!eid) return;

  const link = landingPublicBoardLink(eid);

  // 1) Create the card once under #pageEvent
  let card = document.getElementById('landingQRCard');
  if (!card) {
    const page = document.getElementById('pageEvent');
    if (!page) return;

    card = document.createElement('div');
    card.id = 'landingQRCard';
    card.className = 'card';
    card.style.marginTop = '16px';
    card.innerHTML = `
      <div class="bar" style="justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div>
          <strong>現場報到 / Landing Page</strong>
          <p class="muted" style="margin-top:4px;font-size:13px">
            這個連結和 QR 是給現場參加者報到用的：
            掃描後會開啟 <code>landing.html?event=…</code>，並連接到目前這個活動。
          </p>
        </div>
        <div id="landingQR" style="margin-top:8px"></div>
      </div>
    `;
    page.appendChild(card);
  }

  // 2) Fill QR + buttons into #landingQR
  const host = document.getElementById('landingQR');
  if (!host) return;

  host.innerHTML = `
    <div class="grid-2" style="gap:16px;align-items:center">
      <div id="landingQRCanvas"></div>
      <div>
        <div class="muted" style="word-break:break-all">${link}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <button id="copyLandingLink" class="btn">複製 Landing 連結</button>
          <a class="btn" href="${link}" target="_blank" rel="noopener">開啟 Landing 頁</a>
        </div>
      </div>
    </div>
  `;

  // 3) Create QR code (uses qrcode.min.js already loaded in index.html)
  const canvasHost = document.getElementById('landingQRCanvas');
  if (window.QRCode && canvasHost) {
    // eslint-disable-next-line no-undef
    new QRCode(canvasHost, {
      text: link,
      width: 256,
      height: 256,
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  // 4) Copy button
  document.getElementById('copyLandingLink')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      alert('已複製 Landing 連結');
    } catch (e) {
      // ignore
    }
  });
}


function pollPublicBoardLink(eid, pid) {
  const u = new URL(location.href);
  u.pathname = (u.pathname.replace(/[^/]+$/, '') || '/') + 'public_poll.html';
  u.search = `?event=${encodeURIComponent(eid)}&poll=${encodeURIComponent(pid)}`;
  return u.href;
}
function landingPublicBoardLink(eid) {
  const u = new URL(location.href);
  // same folder as index.html, but go to landing.html
  u.pathname = (u.pathname.replace(/[^/]+$/, '') || '/') + 'landing.html';
  u.search = `?event=${encodeURIComponent(eid)}`;
  return u.href;
}

function showPollQR(link){
  const host = document.getElementById('pollQR');
  if (!host) return;
  host.innerHTML = `
    <div class="grid-2" style="gap:16px;align-items:center">
      <div id="pollQRCanvas"></div>
      <div>
        <div class="muted" style="word-break:break-all">${link}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <button id="copyVoteLink" class="btn">複製投票連結</button>
          <a class="btn" href="${link}" target="_blank" rel="noopener">開啟投票頁</a>
        </div>
      </div>
    </div>`;
  if (window.QRCode && document.getElementById('pollQRCanvas')) {
    // eslint-disable-next-line no-undef
    new QRCode(document.getElementById('pollQRCanvas'), {
      text: link, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.M
    });
  }
  document.getElementById('copyVoteLink')?.addEventListener('click', async ()=>{
    try { await navigator.clipboard.writeText(link); alert('已複製投票連結'); } catch(e){}
  });
}

function createChip(text){
  const span = document.createElement('span');
  span.className = 'chip';
  span.textContent = text;
  span.style.cssText = 'display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.08)';
  const x = document.createElement('button');
  x.textContent = '×';
  x.className = 'btn';
  x.style.cssText = 'margin-left:6px;padding:0 6px;line-height:1.2';
  x.onclick = ()=> span.remove();
  span.appendChild(x);
  return span;
}

function getChipValues(){
  return Array.from(document.querySelectorAll('#optChips .chip'))
    .map(ch => ch.firstChild?.nodeValue?.trim()).filter(Boolean);
}

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
async function renderEventInfo(){
  const eid=getCurrentEventId();
  if(!eid)return;const {meta,info}=await getEventInfo(eid);
  const t=(id,val)=>{const e=document.getElementById(id);if(e)e.value=val||'';};
  t('evLabelPhone', info.labelPhone);
t('evLabelDept',  info.labelDept);
t('evTitle',info.title);
t('evClient',info.client);
t('evDateTime',info.dateTime);
t('evVenue',info.venue);
t('evAddress',info.address);
t('evMapUrl',info.mapUrl);
t('evBus',info.bus);
t('evTrain',info.train);
t('evParking',info.parking);
t('evNotes',info.notes);
t('metaName',meta.name);
t('metaClient',meta.client);
{ const el=document.getElementById('metaListed');
  if(el) el.checked = meta.listed!==false; }
    ensureLandingQR(eid);
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
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

async function renderAssets(){
  const eid = getCurrentEventId();
  if (!eid) return;

  const assets = await getAssets(eid).catch(() => ({
    banner: '',
    logo: '',
    background: '',
    photos: [],
    bannerData: '',
    logoData: '',
    backgroundData: ''
  }));

  const $ = (id) => document.getElementById(id);

  // Fill URL inputs
  if ($('assetLogoUrl'))        $('assetLogoUrl').value        = assets.logo || '';
  if ($('assetBannerUrl'))      $('assetBannerUrl').value      = assets.banner || '';
  if ($('assetBackgroundUrl'))  $('assetBackgroundUrl').value  = assets.background || '';

  // Previews: prefer Data URL, fallback to URL
  const logoSrc       = assets.logoData       || assets.logo       || '';
  const bannerSrc     = assets.bannerData     || assets.banner     || '';
  const backgroundSrc = assets.backgroundData || assets.background || '';

  if ($('assetLogoPreview')) {
    if (logoSrc) {
      $('assetLogoPreview').src = logoSrc;
      $('assetLogoPreview').style.display = 'inline-block';
    } else {
      $('assetLogoPreview').style.display = 'none';
    }
  }

  if ($('assetBannerPreview')) {
    if (bannerSrc) {
      $('assetBannerPreview').src = bannerSrc;
      $('assetBannerPreview').style.display = 'inline-block';
    } else {
      $('assetBannerPreview').style.display = 'none';
    }
  }

  if ($('assetBackgroundPreview')) {
    if (backgroundSrc) {
      $('assetBackgroundPreview').src = backgroundSrc;
      $('assetBackgroundPreview').style.display = 'inline-block';
    } else {
      $('assetBackgroundPreview').style.display = 'none';
    }
  }

  // Photos grid
  const grid = $('photosGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const photos = Array.isArray(assets.photos) ? assets.photos : [];
  if (!photos.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = '尚未加入任何相片 URL。';
    grid.appendChild(p);
    return;
  }

  photos.forEach((url, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'photo';
    wrap.style.display = 'inline-block';
    wrap.style.margin = '4px';
    wrap.innerHTML = `
      <div>
        <img src="${url}" style="max-width:160px;max-height:120px;display:block;margin-bottom:4px" alt="photo ${i+1}">
      </div>
      <div style="font-size:11px;word-break:break-all;margin-bottom:4px">${url}</div>
      <button class="btn small" type="button" data-delete-photo="${i}">刪除</button>
    `;
    grid.appendChild(wrap);
  });

  // Delete handlers
  grid.querySelectorAll('[data-delete-photo]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.getAttribute('data-delete-photo'));
      const eidNow = getCurrentEventId();
      if (!eidNow) return;
      const current = await getAssets(eidNow);
      const list = Array.isArray(current.photos) ? current.photos.slice() : [];
      if (idx >= 0 && idx < list.length) {
        list.splice(idx, 1);
        await setAssets(eidNow, { photos: list });
        await renderAssets();
      }
    });
  });
}
function bindAssets(){
  const $ = (id) => document.getElementById(id);

  // Save button: URL + file uploads
  $('saveAssets')?.addEventListener('click', async () => {
    const eid = getCurrentEventId();
    if (!eid) {
      alert('請先在左側選擇一個活動（Event）。');
      return;
    }

    const logoUrl       = ($('assetLogoUrl')?.value || '').trim();
    const bannerUrl     = ($('assetBannerUrl')?.value || '').trim();
    const backgroundUrl = ($('assetBackgroundUrl')?.value || '').trim();

    const logoFile       = $('assetLogoFile')?.files?.[0] || null;
    const bannerFile     = $('assetBannerFile')?.files?.[0] || null;
    const backgroundFile = $('assetBackgroundFile')?.files?.[0] || null;

    // Keep existing photos; we only change photos through add/delete controls
    const current = await getAssets(eid);
    const photos  = Array.isArray(current.photos) ? current.photos.slice() : [];

    // Read files as Data URL (only if user selected something)
    const [logoData, bannerData, backgroundData] = await Promise.all([
      fileToDataURL(logoFile),
      fileToDataURL(bannerFile),
      fileToDataURL(backgroundFile),
    ]);

    const payload = {
      logo: logoUrl,
      banner: bannerUrl,
      background: backgroundUrl,
      photos
    };

    if (logoData)       payload.logoData       = logoData;
    if (bannerData)     payload.bannerData     = bannerData;
    if (backgroundData) payload.backgroundData = backgroundData;

    await setAssets(eid, payload);
    alert('已儲存素材設定');
    await renderAssets();
  });

  // Add photo URL
  $('addPhoto')?.addEventListener('click', async () => {
    const eid = getCurrentEventId();
    if (!eid) {
      alert('請先在左側選擇一個活動（Event）。');
      return;
    }

    const input = $('assetPhotoUrl');
    const url = (input?.value || '').trim();
    if (!url) return;

    const current = await getAssets(eid);
    const photos = Array.isArray(current.photos) ? current.photos.slice() : [];
    photos.push(url);

    await setAssets(eid, { photos });
    input.value = '';
    await renderAssets();
  });
}

async function renderPolls(){
  const eid = getCurrentEventId();
  const polls = await getPolls(eid);
  const list = document.getElementById('pollList');
  list.innerHTML = '';

  if (!polls || !Object.keys(polls).length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = '尚未建立投票';
    list.appendChild(li);
    return;
  }

  const baseUrl = new URL(location.href);
  const makeLink = (file, pid) => {
    const u = new URL(baseUrl);
    u.pathname = (u.pathname.replace(/[^/]+$/, '') || '/') + file;
    u.search = `?event=${encodeURIComponent(eid)}&poll=${encodeURIComponent(pid)}`;
    return u.href;
  };

  // IMPORTANT: iterate entries so we get the RTDB key
  for (const [pid, p] of Object.entries(polls)) {
    if (!p) continue;
    const pollId = p.id || pid; // prefer embedded id, else key

    const li = document.createElement('li');
    const total = Object.values(p.votes || {}).reduce((a,b)=> a + Number(b || 0), 0);
    const optionsText = (p.options || []).map(o => o.text).join(' / ') || '—';

    const voteUrl   = makeLink('vote.html',        pollId);
    const publicUrl = makeLink('public_poll.html', pollId);

    li.innerHTML = `
      <strong>${p.question || p.q || '(未命名)'}</strong>
      <small>(共 ${total} 票)</small>
      <div class="muted">${optionsText}</div>
      <div class="bar" style="gap:6px;margin-top:6px;flex-wrap:wrap">
        <button class="btn" data-act="qr">QR</button>
        <a class="btn" data-act="public" href="${publicUrl}" target="_blank" rel="noopener">公眾畫面</a>
        <button class="btn" data-act="use">使用此問題</button>
      </div>
    `;

    // QR preview
    li.querySelector('[data-act="qr"]').onclick = () => {
      const host = document.getElementById('pollQR');
      if (!host) return;
      host.innerHTML = `
        <div class="grid-2" style="gap:16px;align-items:center">
          <div id="pollQRCanvas"></div>
          <div>
            <div class="muted" style="word-break:break-all">${voteUrl}</div>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
              <button id="copyVoteLink" class="btn">複製投票連結</button>
              <a class="btn" href="${voteUrl}" target="_blank" rel="noopener">開啟投票頁</a>
            </div>
          </div>
        </div>
      `;
      if (window.QRCode && document.getElementById('pollQRCanvas')) {
        // eslint-disable-next-line no-undef
        new QRCode(document.getElementById('pollQRCanvas'), {
          text: voteUrl, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.M
        });
      }
      const copyBtn = document.getElementById('copyVoteLink');
      if (copyBtn) copyBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(voteUrl); alert('已複製投票連結'); } catch(e) {}
      });
    };

    // Public page click: hint UI state (safe if FB.patch exists)
    const pubBtn = li.querySelector('[data-act="public"]');
    if (pubBtn) pubBtn.addEventListener('click', async () => {
      try { if (window.FB && window.FB.patch) await window.FB.patch(`/events/${eid}/ui`, { currentPollId: pollId, showPollQR: true }); } catch(_){}
    });

    // One-click use-this-poll
    const useBtn = li.querySelector('[data-act="use"]');
    if (useBtn) useBtn.addEventListener('click', async () => {
      try {
        if (window.FB && window.FB.patch) await window.FB.patch(`/events/${eid}/ui`, { currentPollId: pollId, showPollQR: true });
        alert('已設為目前問題');
        bindPollPicker(); // refresh dropdown to reflect selection
      } catch(_){}
    });

    list.appendChild(li);
  }
}


function bindPolls(){document.getElementById('btnAddPoll')?.addEventListener('click',async()=>{const eid=getCurrentEventId();const q=document.getElementById('newPollQ').value.trim();const raw=document.getElementById('newPollOpts').value.trim();if(!q||!raw)return;const options=raw.split(/\n|,/).map(s=>s.trim()).filter(Boolean).map((t,i)=>({id:'o'+(i+1),text:t}));const poll={id:'poll'+Date.now().toString(36),question:q,options,votes:{}};await setPoll(eid,poll);document.getElementById('newPollQ').value='';document.getElementById('newPollOpts').value='';await renderPolls();});}

async function bindPollPicker(){
  const eid   = getCurrentEventId();
  const sel   = document.getElementById('pollPicker');
  const btnSet = document.getElementById('btnSetCurrent');
  const btnQR  = document.getElementById('btnShowPickerQR');
  if (!sel) return;

  // Load polls + UI state (defensive, no optional chaining)
  let polls = {};
  let ui    = {};
  try { polls = await getPolls(eid) || {}; } catch (e) { polls = {}; }
  try { 
    if (window.FB && window.FB.get) {
      ui = await window.FB.get(`/events/${eid}/ui`) || {};
    }
  } catch (e) { ui = {}; }

  const currentId = ui && ui.currentPollId ? ui.currentPollId : null;

  // Build dropdown from entries so we have the poll key as id
  sel.innerHTML = '';
  const entries = Object.entries(polls); // [[pid, poll], ...]
  if (entries.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '（尚未建立投票）';
    sel.appendChild(opt);
  } else {
    for (const [pid, p] of entries) {
      const opt = document.createElement('option');
      opt.value = pid; // use RTDB key as id
      const title = (p && (p.question || p.q)) ? (p.question || p.q) : '(未命名)';
      opt.textContent = title;
      if (pid === currentId) opt.selected = true;
      sel.appendChild(opt);
    }
    // Ensure something is selected
    if (!sel.value && entries[0]) sel.value = entries[0][0];
  }

  // "Set current" button
  if (btnSet) {
    btnSet.onclick = async function(){
      const pid = sel.value;
      if (!pid) return;
      try {
        if (window.FB && window.FB.patch) {
          await window.FB.patch(`/events/${eid}/ui`, { currentPollId: pid, showPollQR: true });
        }
        alert('已設為目前問題');
      } catch (e) { /* ignore */ }
    };
  }

  // "Show QR" button
  if (btnQR) {
    btnQR.onclick = function(){
      const pid = sel.value;
      if (!pid) return;

      const u = new URL(location.href);
      u.pathname = (u.pathname.replace(/[^/]+$/, '') || '/') + 'vote.html';
      u.search = `?event=${encodeURIComponent(eid)}&poll=${encodeURIComponent(pid)}`;
      const link = u.href;

      const host = document.getElementById('pollQR');
      if (!host) return;
      host.innerHTML = (
        '<div class="grid-2" style="gap:16px;align-items:center">' +
          '<div id="pollQRCanvas"></div>' +
          '<div>' +
            '<div class="muted" style="word-break:break-all">' + link + '</div>' +
            '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
              '<button id="copyVoteLink" class="btn">複製投票連結</button>' +
              '<a class="btn" href="' + link + '" target="_blank" rel="noopener">開啟投票頁</a>' +
            '</div>' +
          '</div>' +
        '</div>'
      );

      if (window.QRCode && document.getElementById('pollQRCanvas')) {
        // eslint-disable-next-line no-undef
        new QRCode(document.getElementById('pollQRCanvas'), {
          text: link, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.M
        });
      }
      const copyBtn = document.getElementById('copyVoteLink');
      if (copyBtn) {
        copyBtn.addEventListener('click', async function(){
          try { await navigator.clipboard.writeText(link); alert('已複製投票連結'); } catch (e) {}
        });
      }
    };
  }
}


function bindPollComposer(){
  const inputQ = document.getElementById('pollQInput');
  const inOpt = document.getElementById('optInput');
  const wrap = document.getElementById('optChips');
  const btnCreate = document.getElementById('btnCreatePoll');
  const btnClearStage = document.getElementById('btnClearStage');

  // Enter to add chip
  inOpt?.addEventListener('keydown', e=>{
    if (e.key === 'Enter' && inOpt.value.trim()){
      e.preventDefault();
      wrap.appendChild(createChip(inOpt.value.trim()));
      inOpt.value = '';
    }
  });

  // Create poll
  btnCreate?.addEventListener('click', async ()=>{
    const eid = getCurrentEventId();
    const q = inputQ.value.trim();
    const opts = getChipValues();
    if (!eid || !q || !opts.length) { alert('請輸入問題與至少一個選項'); return; }
    const poll = {
      id: makeId('p'),
      question: q,
      options: opts.map(t => ({ id: makeId('o'), text: t })),
      votes: {}, active: true, createdAt: Date.now()
    };
    await setPoll(eid, poll);
    // show QR of this new poll
    showPollQR(linkTo('vote.html', eid, poll.id));
    // reset UI
    inputQ.value = ''; wrap.innerHTML = '';
    await renderPolls();
  });

  // Clear Stage (hide QR & "next gift" on public screens)
  btnClearStage?.addEventListener('click', async ()=>{
    const eid = getCurrentEventId();
    if (!eid) return;
    // Write simple UI flags the public pages can watch
    await FB.patch(`/events/${eid}/ui`, {
      showPollQR: false,
      showNextPrize: false,
      currentPollId: null
    });
    // also clear local QR panel
    document.getElementById('pollQR').innerHTML = '';
  });
}


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

export async function renderPollManager() {
  const eid = getCurrentEventId();
  const list = document.getElementById('pollManagerList');
  if (!eid || !list) return;

  // Fetch polls from RTDB
  let polls = await getPolls(eid).catch(() => ({}));
  list.innerHTML = '';

  const entries = Object.entries(polls || {});
  if (!entries.length) {
    list.innerHTML = '<li class="muted">尚未建立任何投票問題</li>';
    return;
  }

  for (const [pid, p] of entries) {
    const poll = { id: pid, ...p };
    const li = document.createElement('li');
    li.className = 'poll-item';
    li.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px">
        <input class="poll-question" value="${poll.question || ''}" placeholder="輸入問題..." />
        <div class="poll-options"></div>
        <div class="bar" style="gap:6px;margin-top:4px;flex-wrap:wrap">
          <button class="btn" data-act="save">💾 儲存</button>
          <button class="btn" data-act="delete" style="background:#b71c1c;color:white">刪除</button>
        </div>
      </div>
    `;

    // render options
    const optWrap = li.querySelector('.poll-options');
    const options = poll.options || [];
    optWrap.innerHTML = options
      .map((o, i) => `
        <div class="bar" style="gap:4px">
          <input class="poll-opt" value="${o.text || o}" placeholder="選項 ${i + 1}" />
          ${i === options.length - 1 ? '<button class="btn btn-small" data-act="addopt">＋</button>' : ''}
        </div>
      `)
      .join('') || `
        <div class="bar" style="gap:4px">
          <input class="poll-opt" value="" placeholder="選項 1" />
          <button class="btn btn-small" data-act="addopt">＋</button>
        </div>`;

    // Bind actions
    li.addEventListener('click', async (e) => {
      const act = e.target.dataset.act;
      if (!act) return;

      if (act === 'save') {
        const question = li.querySelector('.poll-question').value.trim();
        const opts = [...li.querySelectorAll('.poll-opt')]
          .map((i) => i.value.trim())
          .filter(Boolean)
          .map((t, idx) => ({ id: `o${idx}`, text: t }));

        if (!question || !opts.length) return alert('請輸入問題與至少一個選項');

        const newPoll = { id: pid, question, options: opts, votes: poll.votes || {} };
        await FB.put(`/events/${eid}/polls/${pid}`, newPoll);
        alert('已儲存');
        renderPollManager();
      }

      if (act === 'delete') {
        if (!confirm('確定刪除此問題？')) return;
        await FB.put(`/events/${eid}/polls/${pid}`, null);
        renderPollManager();
      }

      if (act === 'addopt') {
        const bar = e.target.closest('.poll-options');
        const n = bar.querySelectorAll('.poll-opt').length + 1;
        const div = document.createElement('div');
        div.className = 'bar';
        div.style.gap = '4px';
        div.innerHTML = `
          <input class="poll-opt" value="" placeholder="選項 ${n}" />
          <button class="btn btn-small" data-act="addopt">＋</button>
        `;
        bar.appendChild(div);
      }
    });

    list.appendChild(li);
  }
}

// Add button to create a new poll
document.getElementById('btnAddPoll')?.addEventListener('click', async () => {
  const eid = getCurrentEventId();
  const newId = 'p' + Math.random().toString(36).slice(2, 8);
  const blank = { question: '', options: [{ text: '' }], votes: {} };
  await FB.put(`/events/${eid}/polls/${newId}`, blank);
  renderPollManager();
});


export async function renderAll(){await renderEventList();await renderEventInfo();await renderRoster();await renderPrizes();await renderQuestions();await renderAssets();await renderPolls();}
export async function bootCMS(){
  
  // pick event
  const u = new URL(location.href);
  const eid = u.searchParams.get('event');
  const list = await listEvents();
  if (eid && list.some(e => e.id === eid)) setCurrentEventId(eid);
  else if (list[0]) setCurrentEventId(list[0].id);

  // small helper: call a binder if it exists; await if it returns a promise
  const maybe = async (fn) => {
    try {
      if (typeof fn === 'function') {
        const r = fn();
        if (r && typeof r.then === 'function') await r;
      }
    } catch (err) {
      console.error('[CMS] binder failed:', fn && fn.name, err);
    }
  };
  
  // nav
  const navBtns = document.querySelectorAll('#cmsNav .nav-item');
  navBtns.forEach(b => b.addEventListener('click', () => show(b.dataset.target)));

  // core binders (don’t crash if any is undefined)
  await maybe(bindEventInfoSave);
  await maybe(bindRoster);
  await maybe(bindPrizeActions);
  await maybe(bindQuestions);
  await maybe(bindAssets);
  await maybe(bindPolls);
  try { await renderPollManager(); } catch (e) { console.error(e); }


  // new helpers you recently added — guard them too
  await maybe(bindPollComposer);   // ok if not present
  await maybe(bootEventsAdmin);    // ok if not present
  await maybe(bindPollPicker);     // ok if not present

  // final render
  if (typeof renderAll === 'function') {
    await renderAll();
  } else {
    // legacy compatibility: render per-tab if needed (won’t throw)
    await maybe(renderEventInfo);
    await maybe(renderRoster);
    await maybe(renderPrizes);
    await maybe(renderQuestions);
    await maybe(renderAssets);
  }
    // DEV ONLY: expose helpers to the console safely
  if (typeof window !== 'undefined') {
    try {
      window.FB = FB;
      window.getCurrentEventId = getCurrentEventId;
    } catch (_) {}
}
}

// Let other modules (like events_admin) trigger a full UI refresh
window.refreshCMS = renderAll;
