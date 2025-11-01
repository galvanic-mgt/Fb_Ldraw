// src/poll.js
import { updateData, current } from './state.js';
import { FB } from './fb.js';

export function addPoll(){
  return updateData(data => {
    data.polls = data.polls || [];
    const id = 'poll_' + Math.random().toString(36).slice(2,8);
    data.polls.push({ id, question:'', options:[{id:'a',text:''},{id:'b',text:''}], votes:{} });
    if (!data.currentPollId) data.currentPollId = id;
    return data;
  });
}

export function setActivePoll(id){
  return updateData(data => { data.currentPollId = id || null; return data; });
}

export function ensureVotes(p){
  p.votes = p.votes || {};
  (p.options||[]).forEach(o => { if (typeof p.votes[o.id] !== 'number') p.votes[o.id] = 0; });
  return p;
}

export async function publishPoll(eventId, poll){
  await FB.put(`/events/${encodeURIComponent(eventId)}/polls/${encodeURIComponent(poll.id)}`, poll);
}

export async function pingFirebase(){ return await FB.get('/__ping__'); }