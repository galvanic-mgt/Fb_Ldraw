export const CONFIG = {
  firebaseBase: "https://luckydrawpolls-default-rtdb.asia-southeast1.firebasedatabase.app"
};
export function setFirebaseBase(url){
  if(typeof url==='string' && url.trim()) CONFIG.firebaseBase = url.replace(/\/$/,''); 
}