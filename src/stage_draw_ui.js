// stage_draw_ui.js (top)
import {
  getCurrentEventId, getEventInfo, getPrizes, getCurrentPrizeIdRemote, getPeople
} from './core_firebase.js';

import {
  performDraw, rerollOne, clearScreenResults, exportCurrentWinners, drawState, undoLastDraw,
  renderBatchGrid as renderBatchGridCore,
  renderRerollLog as renderRerollLogCore,
  fitWinnerCardText
} from './stage_draw_logic.js';
import { bindStageGridDelegation } from './stage_draw_logic.js';
import { FB } from './fb.js';

// remove: cellHTML(), renderBatchGrid(), renderRerollLog()


function el(id){ return document.getElementById(id); }

// Grid cell HTML for a winner
function cellHTML(w, idx, mode){
  const name = w?.name||'', dept = w?.dept||'';
  const rerollBtn = (mode==='cms' || mode==='tablet') ? `<button class="btn small reroll" data-idx="${idx}">重抽</button>` : '';
  return `
  <div class="winner-card" data-idx="${idx}">
    <div class="name">${name}</div>
    <div class="dept">${dept}</div>
    ${rerollBtn}
  </div>`;
}
function showCountdown(){
  const el = document.getElementById('stageCountdown');
  if (el) el.classList.add('is-active');
}
function hideCountdown(){
  const el = document.getElementById('stageCountdown');
  if (el) {
    el.classList.remove('is-active');
    el.style.display = '';
  }
}

function renderBatchGrid(gridEl, batch, mode){
  if(!gridEl) return;
  const n = Math.max(1, Math.min(10, (batch||[]).length || 0));
  gridEl.className = `winners-grid winners-${n}`;
  gridEl.innerHTML = (batch||[]).map((w,i)=>cellHTML(w,i,mode)).join('');
}
async function renderRerollLog(){
  const panel = document.getElementById('rerollLogPanel');
  if (!panel) return;
  const eid = getCurrentEventId();
  if (!eid){ panel.innerHTML = ''; return; }
  const data = await FB.get(`/events/${eid}/rerollLog`);
  const list = Array.isArray(data) ? data : [];
  list.sort((a,b)=>(b.time||0)-(a.time||0));
  let html = '<table><thead><tr><th>時間</th><th>獎項</th><th>原得主</th><th>改為</th></tr></thead><tbody>';
  for (const row of list) {
    const t = row.time ? new Date(row.time).toLocaleString() : '';
    const ori = row.replaced ? `${row.replaced.name||''}（${row.replaced.dept||''}）` : '';
    const rep = row.replacement ? `${row.replacement.name||''}（${row.replacement.dept||''}）` : '<span style="opacity:.6">—</span>';
    html += `<tr><td>${t}</td><td>${row.prizeName||row.prizeId||''}</td><td>${ori}</td><td>${rep}</td></tr>`;
  }
  html += '</tbody></table>';
  panel.innerHTML = html;
}
export async function renderStageDraw(mode){
  const eid = getCurrentEventId();
  if(!eid) return;

  // CMS: live-poll stageState so CMS updates when tablet/public draw
  if (mode === 'cms') {
    if (renderStageDraw._cmsTimer) clearInterval(renderStageDraw._cmsTimer);
    const poll = async ()=>{
      try{
        const state = await FB.get(`/events/${eid}/ui/stageState`).catch(()=>null);
        if (!state || !state.winners) return;
        const winnersArray = Array.isArray(state.winners) ? state.winners : Object.values(state.winners);
        renderBatchGridCore(document.getElementById('stageGrid'), winnersArray, 'cms');
        fitWinnerCardText(document.getElementById('stageGrid'), { nameMax: 140, deptMax: 70 });
      }catch(e){/*ignore*/}
    };
    renderStageDraw._cmsTimer = setInterval(poll, 1200);
  }

  const logoEl    = document.getElementById('stageLogo');
  const bannerEl  = document.getElementById('stageBanner');
  const prizeNameEl = document.getElementById('stagePrizeName');
  const prizeLeftEl = document.getElementById('stagePrizeLeft');
  const gridEl    = document.getElementById('stageGrid');
  const overlayEl = document.getElementById('stageCountdown');
  const totalLeftEl = document.getElementById('stageTotalLeft');
  const totalWonEl  = document.getElementById('stageTotalWon');
  if (overlayEl) overlayEl.classList.remove('is-active'); // start hidden


  const [info, prizes, curId] = await Promise.all([
    getEventInfo(eid).then(x=>x.info||{}),
    getPrizes(eid),
    getCurrentPrizeIdRemote(eid)
  ]);
  const cur = (prizes||[]).find(p=>p.id===curId);
  const giftName = cur?.name || '—';
  const left = (cur && typeof cur.quota==='number' && Array.isArray(cur.winners))
    ? Math.max(0, cur.quota - cur.winners.length) : 0;

  // HUD updates — these are the elements you actually have
  if (prizeNameEl) prizeNameEl.textContent = giftName;
  if (prizeLeftEl) prizeLeftEl.textContent = left;

  // Logo/Banner are DIVs — set background or fallback text
  if (logoEl) {
    if (info.logo) { logoEl.style.backgroundImage = `url(${info.logo})`; logoEl.style.backgroundSize='contain'; logoEl.style.backgroundRepeat='no-repeat'; logoEl.style.backgroundPosition='center'; logoEl.textContent=''; }
  }
  if (bannerEl) {
    if (info.banner) { bannerEl.style.backgroundImage = `url(${info.banner})`; bannerEl.style.backgroundSize='cover'; bannerEl.style.backgroundRepeat='no-repeat'; bannerEl.style.backgroundPosition='center'; bannerEl.textContent=''; }
  }

  // Render any last batch already in memory (shared renderer)
  renderBatchGridCore(gridEl, drawState.lastBatch, mode);
  if (mode !== 'public') {
    const fitOpts = { nameMax: 140, deptMax: 70 };
    fitWinnerCardText(gridEl, fitOpts);
  }
  // bind reroll buttons for CMS/tablet
  if (mode === 'cms' || mode === 'tablet') {
    bindStageGridDelegation(mode);
  }

  // Totals updater
  const updateTotals = async () => {
    const [peopleAll, prizesLatest] = await Promise.all([
      getPeople(eid),
      getPrizes(eid)
    ]);
    const presentCount = Array.isArray(peopleAll)
      ? peopleAll.filter(p => p && p.checkedIn).length
      : 0;
    const totalWon = Array.isArray(prizesLatest)
      ? prizesLatest.reduce((acc, p) => acc + ((p?.winners || []).length), 0)
      : 0;
    const totalLeft = Math.max(0, presentCount - totalWon);
    if (totalLeftEl) totalLeftEl.textContent = totalLeft;
    if (totalWonEl)  totalWonEl.textContent  = totalWon;
  };


// Batch buttons: set .active and read it later when rolling
const drawBtnsWrap = document.getElementById('drawBtns');
if (drawBtnsWrap) {
  const btns = Array.from(drawBtnsWrap.querySelectorAll('[data-batch]'));
  const setActive = (btn) => {
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
  // default select 1 if nothing is active yet
  if (!drawBtnsWrap.querySelector('.active') && btns[0]) setActive(btns[0]);
  btns.forEach(b => b.addEventListener('click', () => setActive(b)));
}

  // Clear / Export
  const clearBtn  = document.getElementById('btnClearScreen');
  const exportBtn = document.getElementById('btnExportWinners');
if (clearBtn) {
   clearBtn.onclick = async () => {
     hideCountdown();
     await clearScreenResults(gridEl);
   };
 }  

if (exportBtn) exportBtn.onclick = ()=> exportCurrentWinners();

  // Roll using active batch size
  const rollBtn = document.getElementById('btnRollMain');
  const rollInstantBtn = document.getElementById('btnRollInstant');
  const undoBtn = document.getElementById('btnUndoDraw');
  if (rollBtn) {
    rollBtn.onclick = async ()=>{
  const active = document.querySelector('#drawBtns [data-batch].active');
  const n = active ? Number(active.getAttribute('data-batch')) : 1;

  // >>> show overlay while drawing
  showCountdown();

    await performDraw(n, {
    overlayEl,
    gridEl,
   afterRender: batch => {
    renderBatchGridCore(gridEl, batch, mode);
    if (mode !== 'public') {
      fitWinnerCardText(gridEl, { nameMax: 140, deptMax: 70 });
    }
   }
  });


  // >>> hide overlay once results are rendered
  hideCountdown();

  // refresh HUD & reroll log after a draw
  if (prizeLeftEl) {
    const latest = (await getPrizes(eid)).find(p=>p.id===curId);
    const left2 = latest ? Math.max(0, latest.quota - (latest.winners?.length||0)) : left;
    prizeLeftEl.textContent = left2;
  }
  await updateTotals();
  await renderRerollLogCore();
};

  }

  // Instant roll (skip countdown, keep confetti)
  if (rollInstantBtn) {
    rollInstantBtn.onclick = async ()=>{
      const active = document.querySelector('#drawBtns [data-batch].active');
      const n = active ? Number(active.getAttribute('data-batch')) : 1;

      hideCountdown(); // ensure overlay stays hidden for instant draws
      await performDraw(n, {
        overlayEl,
        gridEl,
        skipCountdown: true,
        afterRender: batch => {
          renderBatchGridCore(gridEl, batch, mode);
          if (mode !== 'public') {
            fitWinnerCardText(gridEl, { nameMax: 140, deptMax: 70 });
          }
        }
      });

      // refresh HUD & reroll log after a draw
      if (prizeLeftEl) {
        const latest = (await getPrizes(eid)).find(p=>p.id===curId);
        const left2 = latest ? Math.max(0, latest.quota - (latest.winners?.length||0)) : left;
        prizeLeftEl.textContent = left2;
      }
      await updateTotals();
      await renderRerollLogCore();
    };
  }

  if (undoBtn) {
    undoBtn.onclick = async ()=>{
      const ok = confirm('確定要復原上一次抽獎結果？此動作會移除剛抽出的得獎者。');
      if (!ok) return;
      try{
        await undoLastDraw();
        // refresh HUD
        const latest = (await getPrizes(eid)).find(p=>p.id===curId);
        const left2 = latest ? Math.max(0, latest.quota - (latest.winners?.length||0)) : left;
        if (prizeLeftEl) prizeLeftEl.textContent = left2;
        await updateTotals();
        await renderRerollLogCore();
        // clear grid display
        renderBatchGridCore(gridEl, [], mode);
      }catch(err){
        alert(err?.message || '無法復原抽獎');
      }
    };
  }

  // Re-fit text on resize
  window.addEventListener('resize', () => fitWinnerCardText(gridEl, { nameMax: 90, deptMax: 32 }), { passive: true });

  // initial totals
  await updateTotals();
}
