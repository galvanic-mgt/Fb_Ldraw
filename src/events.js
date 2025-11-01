// src/events.js
import { FB } from './fb.js';
import { ensureInit, loadAll, saveAll, baseState } from './state.js';

export async function cloudUpsertEventMeta(id){
  const all = loadAll(); const ev = all.events[id];
  if (!ev) return;
  const meta = { name: ev.name || '（未命名）', client: ev.client || '', listed: ev.listed !== false };
  await FB.patch(`/events/${id}/meta`, meta).catch(()=>{});
  await FB.put(`/events_index/${id}`, meta).catch(()=>{});
}

export async function cloudDeleteEvent(id){
  await FB.put(`/events/${id}`, null).catch(()=>{});
  await FB.put(`/events_index/${id}`, null).catch(()=>{});
}

export async function cloudPullEventsIndexIntoLocal(){
  const idx = await FB.get(`/events_index`) || {};
  const all = ensureInit();
  Object.entries(idx).forEach(([id, meta])=>{
    if (!all.events[id]) {
      all.events[id] = { name: meta?.name || '（未命名）', client: meta?.client || '', listed: meta?.listed !== false, data: baseState() };
    }
  });
  saveAll(all);
  return idx;
}

export function createEvent(name, client=''){
  const all = ensureInit();
  const id = 'e' + Math.floor(Date.now() + Math.random()*1e6).toString(36);
  all.events[id] = { name: name||'新活動', client, listed:true, data: baseState() };
  all.currentId = id;
  saveAll(all);
  return id;
}

export function cloneCurrentEvent(newName='複製的活動'){
  const all = ensureInit();
  const cur = all.currentId;
  const src = all.events[cur];
  const id  = 'e' + Math.floor(Date.now() + Math.random()*1e6).toString(36);
  all.events[id] = { 
    name: newName || (src?.name || '副本'),
    client: src?.client || '',
    listed: (src?.listed !== false),
    data: structuredClone(src?.data || baseState())
  };
  all.currentId = id;
  saveAll(all);
  return id;
}