// src/public_stage_boot.js
import { setCurrentEventId } from './core_firebase.js';
import { FB } from './fb.js';
import { renderStageDraw } from './stage_draw_ui.js';

function getEventId() {
  const u = new URL(location.href);
  return u.searchParams.get('event') || null;
}

/**
 * Load logo / banner / background from RTDB and apply to the stage.
 * Uses EXACTLY the same priority as landing.js:
 *   logo   : logoData   > logo
 *   banner : bannerData > banner
 *   bg     : backgroundData > background > first photos[] > banner
 */
async function refreshAssets(eid) {
  if (!eid) return;

  const [
    logo,
    banner,
    background,
    photos,
    logoData,
    bannerData,
    backgroundData
  ] = await Promise.all([
    FB.get(`/events/${eid}/logo`).catch(() => null),
    FB.get(`/events/${eid}/banner`).catch(() => null),
    FB.get(`/events/${eid}/background`).catch(() => null),
    FB.get(`/events/${eid}/photos`).catch(() => null),
    FB.get(`/events/${eid}/logoData`).catch(() => null),
    FB.get(`/events/${eid}/bannerData`).catch(() => null),
    FB.get(`/events/${eid}/backgroundData`).catch(() => null),
  ]);

  const finalLogo   = logoData   || logo   || '';
  const finalBanner = bannerData || banner || '';

  let finalBg = backgroundData || background || '';
  if (!finalBg) {
    if (Array.isArray(photos) && photos.length > 0) {
      finalBg = photos[0];
    } else {
      finalBg = finalBanner;
    }
  }

  const logoEl   = document.getElementById('stageLogo');
  const bannerEl = document.getElementById('stageBanner');
  const rootEl   = document.getElementById('publicRoot');

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

  // Optional: background for the whole public board
  if (rootEl && finalBg) {
    rootEl.style.backgroundImage = `url('${finalBg}')`;
    rootEl.style.backgroundSize = 'cover';
    rootEl.style.backgroundPosition = 'center center';
  }
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

    const prize   = (prizes || []).find(p => p && p.id === curId) || null;
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
  } catch (e) {
    console.warn('[public_stage_boot] refreshCurrentPrize error', e);
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

  // Initial sync
  await refreshAssets(eid);
  await refreshCurrentPrize(eid);

  // Poll updates
  setInterval(() => refreshAssets(eid), 5000);
  setInterval(() => refreshCurrentPrize(eid), 1500);
}

boot();
