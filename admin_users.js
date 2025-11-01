const USERS_KEY='ldraw-users-v1', AUTH_KEY='ldraw-auth-v1';
export function getUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY))||[];}catch{ return []; } }
export function saveUsers(arr){ localStorage.setItem(USERS_KEY, JSON.stringify(arr)); }
export function setAuth(u){ localStorage.setItem(AUTH_KEY, JSON.stringify(u||null)); }
export function getAuth(){ try{ return JSON.parse(localStorage.getItem(AUTH_KEY)); }catch{ return null; } }
export function ensureDefaultAdmin(){
  let users=getUsers();
  if(!users.some(u=>u.username==='admin')){ users.push({username:'admin',password:'admin',role:'admin',events:[]}); saveUsers(users); }
}
export function login(username,password){
  const users=getUsers(); const u=users.find(x=>x.username===username && x.password===password);
  if(!u) return false; setAuth({username:u.username, role:u.role||'admin', events:u.events||[]}); return true;
}
export function restoreSession(){ return getAuth(); }
export function applyRoleUI(role){
  document.querySelectorAll('#cmsNav .nav-item').forEach(el=>{
    const target=el.dataset.target;
    const clientVisible = (target==='pageRoster');
    el.style.display = role==='client' ? (clientVisible?'':'none') : '';
  });
}
export function authUser(){ return getAuth(); }
export function editEventName(){}
export function populateEventList(){}
export function cloneSpecificEvent(){}
export function saveEventData(){}