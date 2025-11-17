// src/public_stage_boot.js
import { setCurrentEventId } from './core_firebase.js';
import { FB } from './fb.js';
import { renderStageDraw } from './stage_draw_ui.js';


function getEventId() {
  const u = new URL(location.href);
  return u.searchParams.get('event') || null;
}

async function refreshAssets(eid) {
  const [logo, banner] = await Promise.all([
    FB.get(`/events/${eid}/logo`).catch(() => null),
    FB.get(`/events/${eid}/banner`).catch(() => null),
  ]);

  const logoBox = document.getElementById('stageLogo');
  const bannerBox = document.getElementById('stageBanner');

  if (logoBox) {
    logoBox.innerHTML = logo ? `<img src="${logo}" alt="logo" />` : 'LOGO';
  }
  if (bannerBox) {
    bannerBox.innerHTML = banner ? `<img src="${banner}" alt="banner" />` : 'Banner space';
  }
}

async function refreshCurrentPrize(eid) {
  const prizeNameEl = document.getElementById('stagePrizeName');
  const prizeLeftEl = document.getElementById('stagePrizeLeft');

  // current prize id is stored at /events/{eid}/currentPrizeId
  const curId = await FB.get(`/events/${eid}/currentPrizeId`).catch(() => null);
  if (!curId) {
    if (prizeNameEl) prizeNameEl.textContent = '—';
    if (prizeLeftEl) prizeLeftEl.textContent = '—';
    return;
  }

  // prizes are stored as an array under /events/{eid}/prizes
  const prizes = await FB.get(`/events/${eid}/prizes`).catch(() => []);
  const cur = (prizes || []).find(p => p && p.id === curId);

  const name = cur?.name || curId;
  let left = '—';
  if (cur && typeof cur.quota === 'number') {
    const taken = Array.isArray(cur.winners) ? cur.winners.length : 0;
    left = Math.max(0, cur.quota - taken);
  }

  if (prizeNameEl) prizeNameEl.textContent = name;
  if (prizeLeftEl) prizeLeftEl.textContent = left;
}

async function boot() {
  const eid = getEventId();
  if (!eid) {
    console.error('[public] Missing ?event= in URL');
    return;
  }

  // Use the same event context as CMS
  setCurrentEventId(eid);

  // Use your existing canvas/animation renderer
  try { renderStageDraw('public'); } catch { renderStageDraw(); }

  // Initial sync
  await refreshAssets(eid);
  await refreshCurrentPrize(eid);

  // Light, reliable polling (can switch to listeners later if you want)
  setInterval(() => refreshAssets(eid), 5000);
  setInterval(() => refreshCurrentPrize(eid), 1500);
}

boot();
