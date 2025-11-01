// src/stage.js
import { updateData, current } from './state.js';
import { prizeLeft } from './prizes.js';

export function drawOnce(batch=1){
  return updateData(data => {
    const left = prizeLeft(data);
    const n = Math.max(1, Math.min(Number(batch)||1, left || batch));
    const pool = (data.remaining||[]);
    if (pool.length === 0) { data.currentBatch = []; return data; }

    // sample unique winners
    const picks = new Set();
    while (picks.size < Math.min(n, pool.length)) {
      picks.add(Math.floor(Math.random()*pool.length));
    }
    const winners = Array.from(picks).map(i => pool[i]);

    // assign to prize
    const cur = (data.prizes||[]).find(p=>p.id===data.currentPrizeId);
    cur.winners = cur.winners || [];
    winners.forEach(w => cur.winners.push({ name:w.name, dept:w.dept||'', time:Date.now() }));

    // move to winners list & rebuild remaining
    data.winners = data.winners || [];
    data.winners.push(...winners);
    const key = v => `${v.name}||${v.dept||''}`;
    const winSet = new Set(data.winners.map(key));
    data.remaining = (data.people||[]).filter(p=>p.checkedIn && !winSet.has(key(p)));
    data.currentBatch = winners;
    data.lastPick = { prizeId: data.currentPrizeId, names: winners.map(w=>w.name), at: Date.now() };
    return data;
  });
}