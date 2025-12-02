// Simple public-side listener for /ui/stageState
import { FB } from './fb.js';
import { renderBatchGrid as renderBatchGridCore, fireConfettiAtCards } from './stage_draw_logic.js';

function getEventId() {
  const u = new URL(location.href);
  return u.searchParams.get('event') || null;
}

const eid = getEventId();
if (!eid) {
  console.error('[public_stage_state] Missing ?event= in URL');
}

// track last batch so we can animate only on changes
let lastWinnersKey = null;

function normalizeWinners(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.values(raw);
}

async function refreshStage() {
  if (!FB?.get || !eid) return;

  try {
    const ui = await FB.get(`/events/${eid}/ui`).catch(() => null);
    const state = ui && ui.stageState ? ui.stageState : null;

    const grid = document.getElementById('stageGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!state || !state.winners) {
      // nothing drawn yet — keep grid empty
      grid.innerHTML = '';
      lastWinnersKey = null;
      return;
    }

    const winnersArray = normalizeWinners(state.winners);
    const key = JSON.stringify(winnersArray.map(w => [w.name, w.dept, w.time]));

    // first load: just render, no countdown
    if (lastWinnersKey === null) {
      renderBatchGridCore(grid, winnersArray, 'public');
      lastWinnersKey = key;
      return;
    }

    // no change: keep grid in sync but no animation
    if (key === lastWinnersKey) {
      renderBatchGridCore(grid, winnersArray, 'public');
      return;
    }

    const skip = (state && state.skipCountdown === true) || ui.skipCountdown === true;

    // new winners: animate (or skip) then render + confetti
    lastWinnersKey = key;

    const overlay = document.getElementById('stageCountdown');
    if (overlay && !skip) {
      overlay.style.display = 'flex';
      overlay.textContent = '3';
      await new Promise(r => setTimeout(r, 600));
      overlay.textContent = '2';
      await new Promise(r => setTimeout(r, 600));
      overlay.textContent = '1';
      await new Promise(r => setTimeout(r, 600));
      overlay.style.display = 'none';
    }

    renderBatchGridCore(grid, winnersArray, 'public');
    const cards = grid.querySelectorAll('.winner-card');
    fireConfettiAtCards(cards);

    // clear skip flag so subsequent draws animate unless requested again
    if (skip) {
      try { await FB.patch(`/events/${eid}/ui/stageState`, { skipCountdown: false }); } catch(_){}
      try { await FB.patch(`/events/${eid}/ui`, { skipCountdown: false }); } catch(_){}
    }

  } catch (e) {
    console.warn('[public_stage_state] refresh error', e);
  }
}

// Initial + polling (simple & reliable)
refreshStage();
setInterval(refreshStage, 1000);
