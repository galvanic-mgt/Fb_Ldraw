import { CONFIG } from './config.js';
const U=(p)=>`${CONFIG.firebaseBase}${p}.json`; const J=(x)=>JSON.stringify(x);
export const FB={ get:async(p)=>fetch(U(p)).then(r=>r.json()), put:async(p,b)=>fetch(U(p),{method:'PUT',body:J(b)}).then(r=>r.json()), patch:async(p,b)=>fetch(U(p),{method:'PATCH',body:J(b)}).then(r=>r.json()), del:async(p)=>fetch(U(p),{method:'DELETE'}).then(r=>r.json()) };