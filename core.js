import { FB } from './fb.js';
export const STORE_KEY='ldraw-events-v4';
export function baseState(){
  return {
    people:[], remaining:[], winners:[],
    prizes:[], currentPrizeId:null, currentBatch:[],
    rerolls:[], snapshots:[],
    eventInfo:{title:'',client:'',dateTime:'',venue:'',address:'',mapUrl:'',bus:'',train:'',parking:'',notes:''},
    questions:[],
    polls:[], currentPollId:null
  };
}
export function loadAll(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {currentId:null, events:{}}; }catch{ return {currentId:null,events:{}};}}
export function saveAll(o){ localStorage.setItem(STORE_KEY, JSON.stringify(o)); }
export function ensureInit(){
  const all = loadAll();
  if(!all.currentId){
    const id = 'e'+Math.floor(Date.now()+Math.random()*1e6).toString(36);
    all.currentId=id; all.events[id]={ name:'新活動', client:'', listed:true, data:baseState() };
    saveAll(all);
  }
  return all;
}
export function current(){
  const all=ensureInit(); const id = all.currentId;
  return { id, meta: all.events[id], data: all.events[id].data };
}
export function setCurrent(id){ const all=ensureInit(); if(all.events[id]){ all.currentId=id; saveAll(all);} }
export function updateData(mut){
  const all=ensureInit(); const id=all.currentId;
  const next = mut ? mut(structuredClone(all.events[id].data)) : all.events[id].data;
  all.events[id].data = next; saveAll(all); return next;
}
export function listEvents(){
  const all=ensureInit();
  return Object.entries(all.events).map(([id,ev])=>({id,name:ev.name,client:ev.client||'',listed:ev.listed!==false}));
}
export async function cloudUpsertEventMeta(id){
  const all=loadAll(); const ev=all.events[id]; if(!ev) return;
  const meta={name:ev.name||'（未命名）', client: ev.client||'', listed: ev.listed!==false};
  await FB.patch(`/events/${id}/meta`, meta).catch(()=>{});
  await FB.put(`/events_index/${id}`, meta).catch(()=>{});
}
export async function cloudDeleteEvent(id){
  await FB.del(`/events/${id}`).catch(()=>{});
  await FB.del(`/events_index/${id}`).catch(()=>{});
}
export async function cloudPullEventsIndexIntoLocal(){
  const idx = await FB.get('/events_index') || {};
  const all=ensureInit();
  Object.entries(idx).forEach(([id,meta])=>{
    if(!all.events[id]) all.events[id] = { name:meta?.name||'（未命名）', client:meta?.client||'', listed:meta?.listed!==false, data:baseState() };
  });
  saveAll(all);
  return idx;
}
export const getAll = loadAll;
export const saveEventData = saveAll;
export const loadEvent = async (id)=> FB.get(`/events/${id}`);