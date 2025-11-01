// src/prizes.js
import { updateData, current } from './state.js';

export function addPrize(name, quota=1){
  return updateData(data => {
    data.prizes = data.prizes || [];
    const id = 'p' + Math.random().toString(36).slice(2,8);
    data.prizes.push({ id, name, quota: Math.max(1, Number(quota)||1), winners:[] });
    return data;
  });
}

export function setCurrentPrize(id){
  return updateData(data => { data.currentPrizeId = id || null; return data; });
}

export function prizeLeft(data){
  const id = data.currentPrizeId;
  const p  = (data.prizes||[]).find(x=>x.id===id);
  if (!p) return 0;
  const done = (p.winners||[]).length;
  return Math.max(0, (Number(p.quota)||1) - done);
}