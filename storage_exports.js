import { current } from './core.js';
function toCSV(rows){
  return rows.map(r=> r.map(v=> `"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
}
export function exportCSV(){
  const {data}=current();
  const rows = [['Name','Dept','CheckedIn','Table','Seat']].concat(
    (data.people||[]).map(p=>[p.name, p.dept||'', p.checkedIn?1:0, p.table||'', p.seat||''])
  );
  const blob = new Blob([toCSV(rows)], {type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='roster.csv'; a.click();
}
export function exportWinnersCSV(){
  const {data}=current();
  const rows = [['Name','Dept','Prize','Time']];
  (data.prizes||[]).forEach(p=> (p.winners||[]).forEach(w=> rows.push([w.name, w.dept||'', p.name, new Date(w.time||Date.now()).toISOString()])));
  const blob = new Blob([toCSV(rows)], {type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='winners.csv'; a.click();
}
export function bindExportWinners(){}
export function download(url, name='download'){ const a=document.createElement('a'); a.href=url; a.download=name; a.click(); }