// src/public_stage_boot.js
import { CONFIG } from './config.js';
import { setCurrentEventId } from './core_firebase.js';
import { FB } from './fb.js';
import { renderStageDraw } from './stage_draw_ui.js';
import { applyBackground } from './ui_background.js';

function getEventId() {
  const u = new URL(location.href);
  return u.searchParams.get('event') || null;
}

function firebaseUrl(path){
  const base = (CONFIG.firebaseBase || '').replace(/\/$/, '');
  return `${base}${path}.json`;
}

let prizesCache = [];
let currentPrizeIdCache = null;

/**
 * Load logo / banner / background from RTDB and apply to the stage.
 * Uses EXACTLY the same priority as landing.js:
 *   logo   : logo
 *   banner : banner
 *   bg     : background > first photos[] > banner
 */
async function refreshAssets(eid) {
  if (!eid) return;

  const [
    logo,
    banner,
    background,
    photos
  ] = await Promise.all([
    FB.get(`/events/${eid}/logo`).catch(() => null),
    FB.get(`/events/${eid}/banner`).catch(() => null),
    FB.get(`/events/${eid}/background`).catch(() => null),
    FB.get(`/events/${eid}/photos`).catch(() => null)
  ]);

  const finalLogo   = logo   || '';
  const finalBanner = banner || '';

  const logoEl   = document.getElementById('stageLogo');
  const bannerEl = document.getElementById('stageBanner');

  // LOGO box
  if (logoEl) {
    if (finalLogo) {
      logoEl.style.backgroundImage = `url('${finalLogo}')`;
      logoEl.textContent = '';
    } else {
      logoEl.style.backgroundImage = '';
      logoEl.textContent = 'LOGO';
    }
  }

  // BANNER box
  if (bannerEl) {
    if (finalBanner) {
      bannerEl.style.backgroundImage = `url('${finalBanner}')`;
      bannerEl.textContent = '';
    } else {
      bannerEl.style.backgroundImage = '';
      bannerEl.textContent = 'Banner space';
    }
  }

  // Full-page background layer with 25% dim
  await applyBackground(eid, { layerId: 'publicBg', dim: 0.25 });
}

/**
 * Keep 現正抽獎： and 此獎尚餘： in sync on the public board
 */
async function refreshCurrentPrize(eid) {
  if (!eid) return;

  try {
    const [prizes, curId] = await Promise.all([
      FB.get(`/events/${eid}/prizes`).catch(() => []),
      FB.get(`/events/${eid}/currentPrizeId`).catch(() => null)
    ]);
    prizesCache = Array.isArray(prizes) ? prizes : [];
    renderCurrentPrize(curId);
  } catch (e) {
    console.warn('[public_stage_boot] refreshCurrentPrize error', e);
  }
}

function renderCurrentPrize(curId) {
  currentPrizeIdCache = curId || null;
  const prize   = (prizesCache || []).find(p => p && p.id === currentPrizeIdCache) || null;
  const nameEl  = document.getElementById('stagePrizeName');
  const leftEl  = document.getElementById('stagePrizeLeft');

  if (nameEl) {
    nameEl.textContent = prize ? (prize.name || '—') : '—';
  }

  if (leftEl) {
    if (prize) {
      const quota  = Number(prize.quota || 0);
      const taken  = Array.isArray(prize.winners) ? prize.winners.length : 0;
      const left   = Math.max(0, quota - taken);
      leftEl.textContent = left;
    } else {
      leftEl.textContent = '—';
    }
  }
}

function subscribePrizeChanges(eid) {
  if (typeof EventSource === 'undefined') return null;
  try {
    const es = new EventSource(firebaseUrl(`/events/${eid}/prizes`));
    es.onmessage = (ev) => {
      try {
        prizesCache = Array.isArray(JSON.parse(ev.data)) ? JSON.parse(ev.data) : [];
        renderCurrentPrize(currentPrizeIdCache);
      } catch (e) {
        // ignore parse errors
      }
    };
    es.onerror = () => {
      es.close();
    };
    return es;
  } catch (e) {
    console.warn('[public_stage_boot] prizes EventSource failed, falling back to polling', e);
    return null;
  }
}

function subscribeCurrentPrize(eid) {
  if (typeof EventSource === 'undefined') return null;
  try {
    const es = new EventSource(firebaseUrl(`/events/${eid}/currentPrizeId`));
    es.onmessage = (ev) => {
      try {
        renderCurrentPrize(JSON.parse(ev.data));
      } catch (e) {
        // ignore parse errors
      }
    };
    es.onerror = () => {
      es.close();
    };
    return es;
  } catch (e) {
    console.warn('[public_stage_boot] currentPrizeId EventSource failed, falling back to polling', e);
    return null;
  }
}

async function boot() {
  const eid = getEventId();
  if (!eid) {
    console.error('[public_stage_boot] Missing ?event= in URL');
    return;
  }

  // Let core_firebase + CMS side know which event this is
  setCurrentEventId(eid);

  // Render the winners grid once up-front in "public" mode
  try {
    renderStageDraw('public');
  } catch (e) {
    console.warn('[public_stage_boot] renderStageDraw public failed, retrying default', e);
    try { renderStageDraw(); } catch (e2) { console.error(e2); }
  }

  // Ensure countdown overlay starts hidden for public board
  const overlay = document.getElementById('stageCountdown');
  if (overlay) {
    overlay.classList.remove('is-active');
    overlay.style.display = 'none';
  }

  // Initial sync
  await refreshAssets(eid);
  await refreshCurrentPrize(eid);

  // Live updates via RTDB streaming when available; fallback to slower polling
  const esPrize  = subscribePrizeChanges(eid);
  const esCur    = subscribeCurrentPrize(eid);
  if (!esCur || !esPrize) {
    setInterval(() => refreshCurrentPrize(eid), 8000);
  }

  // Allow manual/on-demand asset refresh (reduces bandwidth)
  if (typeof window !== 'undefined') {
    window.refreshPublicAssets = () => refreshAssets(eid);
  }
}

boot();
