// Simple public-side listener for /ui/stageState
(function () {
  function getEventId() {
    const u = new URL(location.href);
    return u.searchParams.get('event') || null;
  }

  const eid = getEventId();
  if (!eid) {
    console.error('[public_stage_state] Missing ?event= in URL');
    return;
  }

  async function refreshStage() {
    if (!window.FB?.get) return;

    try {
      const ui = await window.FB.get(`/events/${eid}/ui`).catch(() => null);
      const state = ui && ui.stageState ? ui.stageState : null;

      const grid = document.getElementById('stageGrid');
      const prizeSpan = document.getElementById('stagePrizeName');

      if (!grid) return;

      grid.innerHTML = '';

      if (!state || !state.winners) {
        // nothing drawn yet
        const div = document.createElement('div');
        div.className = 'muted';
        div.textContent = '等待抽獎…';
        grid.appendChild(div);
        return;
      }

      // Optional: fetch prize name
      let prizeName = '';
      if (state.currentPrizeId) {
        const prize = await window.FB.get(`/events/${eid}/prizes/${state.currentPrizeId}`).catch(() => null);
        prizeName = prize?.name || state.currentPrizeId;
      }

      if (prizeSpan) prizeSpan.textContent = prizeName || '—';

      Object.values(state.winners).forEach(w => {
        const card = document.createElement('div');
        card.className = 'winner-card';
        card.innerHTML = `
          <div class="winner-name">${w.name}</div>
          <div class="winner-dept">${w.dept || ''}</div>
        `;
        grid.appendChild(card);
      });
    } catch (e) {
      console.warn('[public_stage_state] refresh error', e);
    }
  }

  // Initial + polling (simple & reliable)
  refreshStage();
  setInterval(refreshStage, 1000);
})();
