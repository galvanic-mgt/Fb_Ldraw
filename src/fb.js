// src/fb.js
import { CONFIG } from './config.js';

function url(path){ return `${CONFIG.firebaseBase}${path}.json`; }

export const FB = {
  get:   async (p) => fetch(url(p)).then(r=>r.json()),
  put:   async (p,b) => fetch(url(p), { method:'PUT',   body:JSON.stringify(b) }).then(r=>r.json()),
  patch: async (p,b) => fetch(url(p), { method:'PATCH', body:JSON.stringify(b) }).then(r=>r.json())
};