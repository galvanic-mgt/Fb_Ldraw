// src/config.js
export const CONFIG = {
  // Change this in ONE place to point the whole app to a new Firebase RTDB
  firebaseBase: "https://luckydrawpolls-default-rtdb.asia-southeast1.firebasedatabase.app"
};

export function setFirebaseBase(url){
  if (!url || typeof url !== 'string') return;
  CONFIG.firebaseBase = url.replace(/\/$/, '');
}