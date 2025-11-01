import { updateData, current } from './core.js';
export function prizeLeft(data){
  const id = data.currentPrizeId;
  const p = (data.prizes||[]).find(x=>x.id===id);
  if(!p) return 0;
  return Math.max(0, (Number(p.quota)||1) - (p.winners?.length||0));
}
export function setCurrentPrize(id){ return updateData(d=>{ d.currentPrizeId=id||null; return d; }); }
export function addWinnerRecords(winners){ return updateData(d=>{ d.winners = (d.winners||[]).concat(winners); return d; }); }
export function addSnapshot(){ return updateData(d=>{ d.snapshots = d.snapshots||[]; d.snapshots.push({at:Date.now(), winners:structuredClone(d.winners||[])}); return d; }); }
export function confirmBatch(){ addSnapshot(); }
export function onConfirmed(){}
export function addPrize(name, quota=1){
  return updateData(d=>{ d.prizes=d.prizes||[]; d.prizes.push({id:'p'+Math.random().toString(36).slice(2,8), name, quota:Number(quota)||1, winners:[]}); return d; });
}
export function drawOne(d){
  const pool = d.remaining||[];
  if(pool.length===0) return null;
  const idx = Math.floor(Math.random()*pool.length);
  return pool[idx];
}
export function pickBatch(n){
  return updateData(d=>{
    const left = prizeLeft(d);
    const need = Math.max(1, Math.min(Number(n)||1, left||n));
    const pool = (d.remaining||[]).slice();
    const picks=[]; const chosen=new Set();
    while(picks.length<Math.min(need,pool.length)){
      const i=Math.floor(Math.random()*pool.length);
      if(chosen.has(i)) continue; chosen.add(i); picks.push(pool[i]);
    }
    d.currentBatch=picks;
    return d;
  });
}
export function drawBatch(n){ return pickBatch(n); }
export function draw(){ return pickBatch(1); }
export function drawEditor(){}
export function drawList(){}
export function setWinner(person){
  return updateData(d=>{
    const key = v=>`${v.name}||${v.dept||''}`;
    const curPrize = (d.prizes||[]).find(p=>p.id===d.currentPrizeId); if(!curPrize) return d;
    curPrize.winners = curPrize.winners||[];
    curPrize.winners.push({ name:person.name, dept:person.dept||'', time:Date.now() });
    d.winners = d.winners||[]; d.winners.push(person);
    const winSet = new Set(d.winners.map(key));
    d.remaining = (d.people||[]).filter(p=>p.checkedIn && !winSet.has(key(p)));
    return d;
  });
}
export function pick(){ const {data}=current(); const w=drawOne(data); if(w) setWinner(w); }
export function pickForPrize(){ return pick(); }
export function pickBatchAndCommit(n){
  return updateData(d=>{
    const left = prizeLeft(d);
    const need = Math.max(1, Math.min(Number(n)||1, left||n));
    const pool = (d.remaining||[]).slice();
    const chosen=new Set(); const picks=[];
    while(picks.length<Math.min(need,pool.length)){
      const i=Math.floor(Math.random()*pool.length);
      if(chosen.has(i)) continue; chosen.add(i); picks.push(pool[i]);
    }
    const curPrize=(d.prizes||[]).find(p=>p.id===d.currentPrizeId); if(!curPrize) return d;
    curPrize.winners = curPrize.winners||[];
    picks.forEach(w=>curPrize.winners.push({name:w.name,dept:w.dept||'',time:Date.now()}));
    d.winners = (d.winners||[]).concat(picks);
    const key=v=>`${v.name}||${v.dept||''}`;
    const winSet=new Set(d.winners.map(key));
    d.remaining=(d.people||[]).filter(p=>p.checkedIn && !winSet.has(key(p)));
    d.currentBatch=picks;
    return d;
  });
}
export const pickBatchCommit = pickBatchAndCommit;
export function reroll(){ return updateData(d=>{ d.rerolls=d.rerolls||[]; d.rerolls.push({at:Date.now(), type:'manual'}); return d; }); }
export function rerollBatch(){ return reroll(); }
export function rerollCurrent(){ return reroll(); }
export function rerollLast(){ return reroll(); }
export function undoReroll(){}