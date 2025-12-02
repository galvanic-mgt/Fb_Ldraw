import { FB } from './fb.js';
import { getAssets } from './core_firebase.js';
import { applyBackground } from './ui_background.js';

const url = new URL(location.href);
const eid = url.searchParams.get('event');
const pidFromUrl = url.searchParams.get('poll');

const $ = s => document.querySelector(s);

function voteLink(eid, pid){
  const u = new URL(location.href);
  u.pathname = (u.pathname.replace(/[^/]+$/, '') || '/') + 'vote.html';
  u.search = `?event=${encodeURIComponent(eid)}&poll=${encodeURIComponent(pid)}`;
  return u.href;
}

function drawQR(link){
  const panel = $('#qrPanel');
  const qrEl = $('#qr');
  const textEl = $('#qrLink');
  if (!panel) return;
  qrEl.innerHTML = '';
  // eslint-disable-next-line no-undef
  new QRCode(qrEl, { text: link, width: 320, height: 320, correctLevel: QRCode.CorrectLevel.M });
  textEl.textContent = link;
}

// choose which poll to show
async function resolvePollId(eid){
  const url = new URL(location.href);
  const pidFromUrl = url.searchParams.get('poll');
  if (pidFromUrl) return pidFromUrl;
  const ui = await FB.get(`/events/${eid}/ui`);
  return ui?.currentPollId || null;
}


function renderBars(poll){
  $('#pollQ').textContent = poll.question || '投票';
  const votes = poll.votes || {};
  const opts  = poll.options || [];
  const total = Object.values(votes).reduce((a,b)=> a + Number(b || 0), 0);
  $('#total').textContent = `共 ${total} 票`;

  const bars = $('#bars'); bars.innerHTML = '';
  const max = Math.max(1, ...Object.values(votes).map(Number));

  opts.forEach(o=>{
    const count = Number(votes[o.id] || 0);
    const pct = total ? Math.round((count/total)*100) : 0;
    const row = document.createElement('div'); row.className = 'barRow';

    const thumb = document.createElement('div');
    thumb.className = 'barThumb';
    if (o.img) {
      thumb.style.backgroundImage = `url('${o.img}')`;
    } else {
      thumb.textContent = (o.text || '?').slice(0,1).toUpperCase();
    }

    const barWrap = document.createElement('div');
    barWrap.className = 'barWrap';
    const fill = document.createElement('div');
    fill.className = 'barFill';
    fill.style.width = `${Math.max(6, pct)}%`;
    fill.textContent = o.text;
    const label = document.createElement('div');
    label.className = 'barLabel';
    label.textContent = `${count} 票`;

    barWrap.appendChild(fill);
    barWrap.appendChild(label);
    row.appendChild(thumb);
    row.appendChild(barWrap);
    bars.appendChild(row);
  });
}

async function getCurrentPollId(){
  // Prefer explicit poll in URL, else read ui.currentPollId
  if (pidFromUrl) return pidFromUrl;
  const ui = await FB.get(`/events/${eid}/ui`);
  return ui?.currentPollId || null;
}

async function refresh(){
  if (!eid) return;
  await applyBackground(eid, { layerId: 'publicBg', dim: 0.25 });

  // read UI flags (show/hide QR, next gift etc.)
  const ui = await FB.get(`/events/${eid}/ui`) || {};
  $('#qrPanel').classList.toggle('hidden', ui.showPollQR === false);

  const pid = pidFromUrl || ui.currentPollId;
  if (!pid) return;

  const poll = await FB.get(`/events/${eid}/polls/${pid}`);
  if (!poll) return;

  // QR uses vote link for this poll
  drawQR(voteLink(eid, pid));
  renderBars(poll);

  // footer info
  $('#footLeft').textContent = ui.showNextPrize === false ? '' : (ui.nextPrizeLabel || '');
}

(async function boot(){
  if (!eid){ return; }
  // brand + background
  try {
    const assets = await getAssets(eid);
    const logoSrc = assets.logoData || assets.logo || '';
    const bannerSrc = assets.bannerData || assets.banner || '';
    const logoEl = $('#boardLogo');
    const bannerEl = $('#boardBanner');
    if (logoEl) {
      if (logoSrc) {
        logoEl.style.backgroundImage = `url('${logoSrc}')`;
        logoEl.textContent = '';
      } else {
        logoEl.style.backgroundImage = '';
        logoEl.textContent = 'LOGO';
      }
    }
    if (bannerEl) {
      if (bannerSrc) {
        bannerEl.style.backgroundImage = `url('${bannerSrc}')`;
        bannerEl.textContent = '';
      } else {
        bannerEl.style.backgroundImage = '';
        bannerEl.textContent = 'Banner';
      }
    }
    await applyBackground(eid, { layerId: 'publicBg', dim: 0.25 });
  } catch (e) {
    console.warn('[poll board] brand/background load failed', e);
  }
  await refresh();
  // polling loop for simplicity; swap for onValue if you later use SDK
  setInterval(refresh, 1500);
})();
