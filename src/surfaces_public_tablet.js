import { FB } from './fb.js';
function qsAll(){ const u=new URL(location.href); return Object.fromEntries(u.searchParams.entries()); }
export async function renderPublicBoard(){
  const { event }=qsAll(); if(!event) return;
  const root=document.getElementById('publicBoard'); if(!root) return;
  async function drawOnce(){
    const [meta,info,prizes,curId]=await Promise.all([FB.get(`/events/${event}/meta`),FB.get(`/events/${event}/info`),FB.get(`/events/${event}/prizes`),FB.get(`/events/${event}/currentPrizeId`)]);
    root.innerHTML='';
    const title=document.createElement('h1'); title.textContent=info?.title||meta?.name||'活動'; root.appendChild(title);
    const cur=(prizes||[]).find(p=>p.id===curId);
    const h2=document.createElement('h2'); h2.textContent=cur?`目前獎項：${cur.name}`:'未選擇獎項'; root.appendChild(h2);
    const list=document.createElement('div'); list.className='winners-list';
    const allw=(prizes||[]).flatMap(p=>(p.winners||[]).map(w=>({p:p.name, ...w})));
    allw.slice(-40).forEach(w=>{ const s=document.createElement('span'); s.className='chip'; s.textContent=w.name; list.appendChild(s); });
    root.appendChild(list);
  }
  await drawOnce(); setInterval(drawOnce, 4000);
}
export async function renderTabletView(){
  const { event }=qsAll(); if(!event) return;
  const root=document.getElementById('tabletPane'); if(!root) return;
  async function drawOnce(){
    const [people, prizes, curId] = await Promise.all([FB.get(`/events/${event}/people`), FB.get(`/events/${event}/prizes`), FB.get(`/events/${event}/currentPrizeId`)]);
    root.innerHTML='';
    const cur=(prizes||[]).find(p=>p.id===curId);
    const left=cur?Math.max(0,(Number(cur.quota)||1)-(cur.winners?.length||0)):0;
    const stat=document.createElement('div'); stat.className='stat'; stat.textContent=`此獎尚餘：${left}`; root.appendChild(stat);
    const poolSet=new Set((prizes||[]).flatMap(p=>(p.winners||[]).map(w=>`${w.name}||${w.dept||''}`)));
    const remaining=(people||[]).filter(p=> p.checkedIn && !poolSet.has(`${p.name}||${p.dept||''}`));
    const ul=document.createElement('ul'); remaining.slice(0,50).forEach(p=>{ const li=document.createElement('li'); li.textContent=p.name; ul.appendChild(li); }); root.appendChild(ul);
  }
  await drawOnce(); setInterval(drawOnce, 4000);
}