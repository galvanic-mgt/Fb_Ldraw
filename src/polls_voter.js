// src/polls_voter.js
import { getPoll, incrementVote } from './polls_public_firebase.js';
import { setCurrentEventId, getAssets } from './core_firebase.js';
import { applyBackground } from './ui_background.js';

const $ = s => document.querySelector(s);
const url = new URL(location.href);
const eid = url.searchParams.get('event');
const pid = url.searchParams.get('poll');

if (eid) setCurrentEventId(eid);

async function hydrateBrand() {
  if (!eid) return;
  try {
    const assets = await getAssets(eid);
    const logoSrc = assets.logoData || assets.logo || '';
    const bannerSrc = assets.bannerData || assets.banner || '';

    const logoEl = $('#voteLogo');
    if (logoEl) {
      if (logoSrc) {
        logoEl.style.backgroundImage = `url('${logoSrc}')`;
        logoEl.textContent = '';
      } else {
        logoEl.style.backgroundImage = '';
        logoEl.textContent = 'LOGO';
      }
    }

    const bannerEl = $('#voteBanner');
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
    console.warn('[vote] hydrate brand failed', e);
  }
}

async function main() {
  if (!eid || !pid) {
    $('#err').textContent = '連結不完整（缺少 event 或 poll）';
    $('#err').classList.remove('hidden');
    return;
  }
  await hydrateBrand();
  const poll = await getPoll(eid, pid);
  if (!poll || poll.active === false) {
    $('#err').textContent = '此投票未啟用或不存在';
    $('#err').classList.remove('hidden');
    return;
  }
  $('#pollQ').textContent = poll.question || poll.q || '投票';
  const wrap = $('#optWrap');
  wrap.innerHTML = '';
  (poll.options || []).forEach(opt => {
    const a = document.createElement('button');
    a.className = 'opt-card';
    const img = opt.img || '';
    const label = opt.text || '';
    const initial = (label || '?').slice(0, 1).toUpperCase();
    a.innerHTML = `
      <div class="thumb">
        ${img ? `<img src="${img}" alt="${label}">` : `<div class="thumb-placeholder">${initial}</div>`}
      </div>
      <div class="opt-body">
        <div class="opt-text">${label}</div>
        <div class="opt-meta">點擊選擇</div>
      </div>
    `;
    a.onclick = async () => {
      try {
        // simple 1-device 1-vote guard using localStorage by poll id
        const key = `voted:${eid}:${pid}`;
        if (localStorage.getItem(key)) {
          $('#status').textContent = '已投過票。';
          return;
        }
        await incrementVote(eid, pid, opt.id);
        localStorage.setItem(key, '1');
        $('#done').classList.remove('hidden');
        $('#status').textContent = '';
        // optionally disable buttons
        wrap.querySelectorAll('button').forEach(b => b.disabled = true);
      } catch(e) {
        $('#err').textContent = '投票失敗，請稍後再試';
        $('#err').classList.remove('hidden');
      }
    };
    wrap.appendChild(a);
  });
}
main();
