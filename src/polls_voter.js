// src/polls_voter.js
import { getPoll, incrementVote } from './polls_public_firebase.js';
import { setCurrentEventId } from './core_firebase.js';

const $ = s => document.querySelector(s);
const url = new URL(location.href);
const eid = url.searchParams.get('event');
const pid = url.searchParams.get('poll');

if (eid) setCurrentEventId(eid);

async function main() {
  if (!eid || !pid) {
    $('#err').textContent = '連結不完整（缺少 event 或 poll）';
    $('#err').classList.remove('hidden');
    return;
  }
  const poll = await getPoll(eid, pid);
  if (!poll || poll.active === false) {
    $('#err').textContent = '此投票未啟用或不存在';
    $('#err').classList.remove('hidden');
    return;
  }
  $('#pollQ').textContent = poll.q || '投票';
  const wrap = $('#optWrap');
  wrap.innerHTML = '';
  (poll.options || []).forEach(opt => {
    const a = document.createElement('button');
    a.className = 'opt';
    a.textContent = opt.text;
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
