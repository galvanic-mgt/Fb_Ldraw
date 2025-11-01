// src/state.js
export const STORE_KEY='ldraw-events-v3';
export const SNAP_KEY ='ldraw-snapshots-v1';

export function baseState(){
  return {
    people:[], remaining:[], winners:[],
    bg:null, logo:null, banner:null,
    pageSize:12, pages:[{id:1}], currentPage:1,
    lastConfirmed:null, lastPick:null, currentBatch:[],
    prizes:[], currentPrizeId:null,
    eventInfo:{title:'',client:'',dateTime:'',venue:'',address:'',mapUrl:'',bus:'',train:'',parking:'',notes:''},
    questions:[], rerolls:[],
    // polls kept here for local-only preview
    polls:[], currentPollId:null, pollPublic:false, pollResultPublic:false
  };
}

export function loadAll(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || { currentId:null, events:{} }; }
  catch{ return { currentId:null, events:{} }; }
}

export function saveAll(o){ localStorage.setItem(STORE_KEY, JSON.stringify(o)); }

export function ensureInit(){
  const all = loadAll();
  if (!all.currentId) {
    const id = 'e' + Math.floor(Date.now() + Math.random()*1e6).toString(36);
    all.currentId = id;
    all.events[id] = { name:'新活動', client:'', listed:true, data: baseState() };
    saveAll(all);
  }
  return all;
}

export function current(){
  const all = ensureInit();
  const id  = all.currentId;
  return { id, meta: all.events[id], data: all.events[id].data };
}

export function setCurrent(id){
  const all = ensureInit();
  if (all.events[id]) {
    all.currentId = id;
    saveAll(all);
  }
}

export function updateData(mutator){
  const all = ensureInit();
  const id  = all.currentId;
  const data = all.events[id].data || baseState();
  const next = mutator ? mutator(structuredClone(data)) : data;
  all.events[id].data = next;
  saveAll(all);
  return next;
}

export function listEvents(){
  const all = ensureInit();
  return Object.entries(all.events).map(([id, ev]) => ({ id, name:ev.name, client:ev.client||'', listed: ev.listed!==false }));
}