// src/roster.js
import { updateData, current } from './state.js';

export function rebuildRemaining(data){
  const winnersSet = new Set((data.winners||[]).map(w => `${w.name}||${w.dept||''}`));
  data.remaining = (data.people||[]).filter(p => p.checkedIn && !winnersSet.has(`${p.name}||${p.dept||''}`));
  return data;
}

export function addPerson({name, dept, present=false, table='', seat=''}){
  return updateData(data => {
    data.people = data.people || [];
    data.people.push({ name, dept, checkedIn: !!present, table, seat });
    return rebuildRemaining(data);
  });
}

export function markCheckinByCode(code){
  return updateData(data => {
    const guest = (data.people||[]).find(p => String(p.code||'') === String(code));
    if (guest) guest.checkedIn = true;
    return rebuildRemaining(data);
  });
}