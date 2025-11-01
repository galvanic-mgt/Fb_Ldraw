import { FB } from './fb.js';
import { getCurrentEventId } from './core_firebase.js';
export async function publishPoll(poll){ const eid=getCurrentEventId(); await FB.put(`/events/${eid}/polls/${poll.id}`, poll); }
export async function getPoll(eid, pid){ return await FB.get(`/events/${eid}/polls/${pid}`); }
export async function incrementVote(eid, pid, optionId){ const cur=await FB.get(`/events/${eid}/polls/${pid}/votes/${optionId}`); const next=(typeof cur==='number'?cur:0)+1; await FB.put(`/events/${eid}/polls/${pid}/votes/${optionId}`, next); return next; }