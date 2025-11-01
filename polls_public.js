import { FB } from './fb.js';
import { updateData, current, saveAll, loadAll } from './core.js';
export function ensurePollVotes(p){
  p.votes = p.votes || {};
  (p.options||[]).forEach(o=>{ if(typeof p.votes[o.id] !== 'number') p.votes[o.id]=0; });
  return p;
}
export function renderPollEditor(){}
export function renderPollVote(){}
export function renderPollResult(){}
export function renderPublicPollBoard(){}
export function startPublicPollResults(){}
export function buildOrderByVotes(p){
  const arr = Object.entries(p.votes||{}).map(([id,v])=>({id, v:Number(v)||0}));
  arr.sort((a,b)=> b.v - a.v);
  return arr;
}
export async function publishPoll(eventId, poll){ await FB.put(`/events/${eventId}/polls/${poll.id}`, poll); }