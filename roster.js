import { updateData, current } from './core.js';
export function normalizeName(s){ return (s||'').trim().replace(/\s+/g,' '); }
export function rebuildRemaining(data){
  const set = new Set((data.winners||[]).map(w=>`${w.name}||${w.dept||''}`));
  data.remaining = (data.people||[]).filter(p=>p.checkedIn && !set.has(`${p.name}||${p.dept||''}`));
  return data;
}
export function renderGuestList(){}
export function renderGuestListPage(){}
export function filterBySearch(){}
export function setGuestCheckedIn(name, checked=true){
  return updateData(d=>{ const p=(d.people||[]).find(x=>x.name===name); if(p) p.checkedIn=!!checked; return rebuildRemaining(d); });
}
export function getGuestByCode(code){
  const {data}=current(); return (data.people||[]).find(p=>String(p.code||'')===String(code));
}
export function getGuestByName(name){
  const {data}=current(); return (data.people||[]).find(p=>p.name===name);
}
export function createQRForGuest(){}
export function drawQR(){}
export function removeGuest(name){ return updateData(d=>{ d.people=(d.people||[]).filter(p=>p.name!==name); return rebuildRemaining(d); }); }
export function splitCSVLine(line){ return line.split(',').map(s=>s.trim()); }
export function importCSV(text){
  const rows = text.split(/\r?\n/).filter(Boolean).map(splitCSVLine);
  return updateData(d=>{
    d.people = rows.map(r=>({name:normalizeName(r[0]||''), dept:r[1]||'', checkedIn:Boolean(r[2]&&r[2]!=='0'), table:r[3]||'', seat:r[4]||''}));
    return rebuildRemaining(d);
  });
}
export function handleImportCSV(file, cb){
  const reader = new FileReader();
  reader.onload = ()=>{ importCSV(String(reader.result)); if(cb) cb(); };
  reader.readAsText(file);
}
export function importXLSX(){}
export function handleImportXLSX(){}
export function handleGuestCheckin(code){ return setGuestCheckedIn(getGuestByCode(code)?.name||'', true); }