// src/public_stage_boot.js
import { FB, setCurrentEventId } from './core_firebase.js';
import { renderStageDraw } from './stage_prizes_firebase.js';

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

  const curId = await FB.get(`/events/${eid}/currentPrizeId`).catch(() => null);
  if (!curId) {
    if (prizeNameEl) prizeNameEl.textContent = '—';
    if (prizeLeftEl) prizeLeftEl.textContent = '—';
    return;
  }

  const prize = await FB.get(`/events/${eid}/prizes/${curId}`).catch(() => null);
  if (prizeNameEl) prizeNameEl.textContent = prize?.name || curId;
  if (prizeLeftEl)  prizeLeftEl.textContent  = typeof prize?.left === 'number' ? prize.left : '—';
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
