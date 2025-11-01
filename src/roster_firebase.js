import { getCurrentEventId, getPeople, setPeople, arrayClone } from './core_firebase.js';
export async function loadRoster(){ const eid=getCurrentEventId(); return await getPeople(eid); }
export function normalizeName(s){ return (s||'').trim().replace(/\s+/g,' '); }
export async function setGuestCheckedIn(name, checked=true){ const eid=getCurrentEventId(); const people=await getPeople(eid); const p=people.find(x=>x.name===name); if(p){ p.checkedIn=!!checked; await setPeople(eid,people);} return people; }
export async function removeGuest(name){ const eid=getCurrentEventId(); const people=(await getPeople(eid)).filter(p=>p.name!==name); await setPeople(eid,people); return people; }
export function splitCSVLine(line){ return line.split(',').map(s=>s.trim()); }
export async function importCSV(text){ const eid=getCurrentEventId(); const rows=text.split(/\r?\n/).filter(Boolean).map(splitCSVLine); const people=rows.map(r=>({name:normalizeName(r[0]||''),dept:r[1]||'',checkedIn:Boolean(r[2]&&r[2]!=='0'),table:r[3]||'',seat:r[4]||''})); await setPeople(eid,people); return people; }
export function handleImportCSV(file, cb){ const reader=new FileReader(); reader.onload=async()=>{ await importCSV(String(reader.result)); if(cb) cb(); }; reader.readAsText(file); }
export function filterBySearch(people,q){ q=(q||'').toLowerCase(); return arrayClone(people).filter(p=> (p.name||'').toLowerCase().includes(q) || (p.dept||'').toLowerCase().includes(q)); }