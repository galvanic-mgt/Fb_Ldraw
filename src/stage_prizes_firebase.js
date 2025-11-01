import { getCurrentEventId, getPeople, getPrizes, setPrizes, getCurrentPrizeIdRemote, setCurrentPrizeIdRemote } from './core_firebase.js';
export async function setCurrentPrize(id){ const eid=getCurrentEventId(); await setCurrentPrizeIdRemote(eid,id); }
export async function addPrize(name, quota=1){ const eid=getCurrentEventId(); const prizes=await getPrizes(eid); const p={id:'p'+Math.random().toString(36).slice(2,8), name, quota:Math.max(1,Number(quota)||1), winners:[]}; prizes.push(p); await setPrizes(eid,prizes); return p.id; }
export function prizeLeftLocal(prize){ if(!prize) return 0; const done=(prize.winners||[]).length; return Math.max(0,(Number(prize.quota)||1)-done); }
function pickUnique(pool,n){ const chosen=new Set(),picks=[]; while(picks.length<Math.min(n,pool.length)){ const i=Math.floor(Math.random()*pool.length); if(chosen.has(i)) continue; chosen.add(i); picks.push(pool[i]); } return picks; }
export async function drawBatch(n=1){
  const eid=getCurrentEventId();
  const [people, prizes, curId] = await Promise.all([ getPeople(eid), getPrizes(eid), getCurrentPrizeIdRemote(eid) ]);
  const cur=(prizes||[]).find(p=>p.id===curId); if(!cur) return {batch:[],prizes};
  const winnersSet = new Set((prizes||[]).flatMap(p => (p.winners||[]).map(w => `${w.name}||${w.dept||''}`)));
  const pool=(people||[]).filter(p=> p.checkedIn && !winnersSet.has(`${p.name}||${p.dept||''}`));
  const need=prizeLeftLocal(cur); const count=Math.max(1, Math.min(Number(n)||1, need||n));
  const picks = pickUnique(pool, count);
  cur.winners = cur.winners || []; picks.forEach(w=> cur.winners.push({name:w.name, dept:w.dept||'', time:Date.now()}));
  await setPrizes(eid, prizes);
  return { batch:picks, prizes };
}