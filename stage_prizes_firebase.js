// src/stage_prizes_firebase.js — prizes data ops + draw core

import {
  getCurrentEventId,
  getPeople, setPeople,
  getPrizes, setPrizes,
  getCurrentPrizeIdRemote, setCurrentPrizeIdRemote,
} from './core_firebase.js';

/* ----------------- helpers ----------------- */
export function prizeLeftLocal(prize) {
  const quota = Number(prize?.quota || 0);
  const taken = Array.isArray(prize?.winners) ? prize.winners.length : 0;
  return Math.max(0, quota - taken);
}

function pickUnique(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function ensurePrizeShape(p) {
  return {
    id: p.id,
    name: p.name || '新獎項',
    quota: Math.max(0, Number(p.quota || 0)),
    winners: Array.isArray(p.winners) ? p.winners : [],
  };
}

/* ----------------- CRUD for prizes (used by CMS UI) ----------------- */

// CREATE
export async function addPrize(partial = {}) {
  const eid = getCurrentEventId();
  if (!eid) throw new Error('尚未選擇活動');

  const prizes = (await getPrizes(eid)) || [];
  const id = partial.id || ('p' + Math.random().toString(36).slice(2, 8));

  if (prizes.some(p => p?.id === id)) {
    throw new Error('獎項 ID 重複：' + id);
  }

  const prize = ensurePrizeShape({ id, ...partial });
  prizes.push(prize);
  await setPrizes(eid, prizes);
  return prize;
}

// UPDATE (by id)
export async function updatePrize(patch = {}) {
  const eid = getCurrentEventId();
  if (!eid) throw new Error('尚未選擇活動');
  if (!patch.id) throw new Error('缺少獎項 ID');

  const prizes = (await getPrizes(eid)) || [];
  const idx = prizes.findIndex(p => p?.id === patch.id);
  if (idx < 0) throw new Error('找不到獎項：' + patch.id);

  const merged = ensurePrizeShape({ ...prizes[idx], ...patch });
  prizes[idx] = merged;
  await setPrizes(eid, prizes);
  return merged;
}

// DELETE (by id)
export async function removePrize(prizeId) {
  const eid = getCurrentEventId();
  if (!eid) throw new Error('尚未選擇活動');
  if (!prizeId) throw new Error('缺少獎項 ID');

  const [prizes, curId] = await Promise.all([
    getPrizes(eid),
    getCurrentPrizeIdRemote(eid),
  ]);
  const next = (prizes || []).filter(p => p?.id !== prizeId);
  await setPrizes(eid, next);

  // if currently selected prize was deleted, clear current
  if (curId === prizeId) {
    await setCurrentPrizeIdRemote(eid, null);
  }
  return true;
}

// --- SELECT / SET CURRENT PRIZE (needed by ui_cms_firebase.js) ---
export async function setCurrentPrize(prizeId) {
  const eid = getCurrentEventId();
  if (!eid) throw new Error('尚未選擇活動');

  // allow clearing selection by passing null/undefined/empty
  const pid = prizeId || null;

  // sanity: confirm the prize exists if a non-null id is provided
  if (pid) {
    const prizes = (await getPrizes(eid)) || [];
    const exists = prizes.some(p => p && p.id === pid);
    if (!exists) throw new Error(`找不到獎項：${pid}`);
  }

  await setCurrentPrizeIdRemote(eid, pid);
  return pid;
}

/* ----------------- draw core ----------------- */
export async function drawBatch(n = 1) {
  try {
    const eid = getCurrentEventId?.();
    if (!eid) throw new Error('尚未選擇活動');

    const [people, prizes, curId] = await Promise.all([
      getPeople(eid),
      getPrizes(eid),
      getCurrentPrizeIdRemote(eid),
    ]);

    if (!Array.isArray(people)) throw new Error('人員名單讀取失敗');
    if (!Array.isArray(prizes)) throw new Error('獎項資料讀取失敗');

    const cur = prizes.find(p => p && p.id === curId);
    if (!cur) throw new Error('尚未選擇抽獎項目');

    const need = prizeLeftLocal(cur);
    if (need <= 0) throw new Error('此獎項名額已滿');

    // no-repeat across ALL prizes
    const winnersSet = new Set(
      prizes.flatMap(p => (p?.winners || []).map(w => `${w.name}||${w.dept || ''}`))
    );

    const pool = people.filter(p =>
      p && p.checkedIn && !winnersSet.has(`${p.name}||${p.dept || ''}`)
    );
    if (pool.length === 0) throw new Error('沒有可抽名單（請檢查出席狀態或已有得獎紀錄）');

    const want = Math.max(1, Math.min(Number(n) || 1, 10, need, pool.length));
    const picks = pickUnique(pool, want);

    cur.winners = Array.isArray(cur.winners) ? cur.winners : [];
    const prizeName = cur.name || '';
    const now = Date.now();

    const winnerKeys = new Set();
    picks.forEach(w => {
      cur.winners.push({ name: w.name, dept: w.dept || '', time: now });
      winnerKeys.add(`${w.name}||${w.dept || ''}`);
    });

    const peopleUpdated = people.map(p =>
      winnerKeys.has(`${p.name}||${p.dept || ''}`) ? { ...p, prize: prizeName } : p
    );

    await setPrizes(eid, prizes);
    await setPeople(eid, peopleUpdated);

    return { ok: true, batch: picks, prizes };
  } catch (err) {
    alert(`[Draw Error] drawBatch failed\n${err?.message || String(err)}`);
    throw err;
  }
}
