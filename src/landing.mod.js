// src/landing.mod.js
import { FB } from './fb.js';

function qs(key){ const u=new URL(location.href); return u.searchParams.get(key); }
function t(id, val){ const e=document.getElementById(id); if(e) e.textContent = val || ''; }

async function boot(){
  const eventId = qs('event') || '';
  if (!eventId) return;

  const meta = await FB.get(`/events/${eventId}/meta`) || {};
  const info = await FB.get(`/events/${eventId}/info`) || {};
  const banner = await FB.get(`/events/${eventId}/banner`);
  const logo   = await FB.get(`/events/${eventId}/logo`);

  if (banner) { const b=document.getElementById('banner'); b.style.backgroundImage = `url(${banner})`; }
  if (logo)   { const l=document.getElementById('logo'); l.src = logo; }

  t('evTitle',    info.title || meta.name || '活動');
  t('evDateTime', info.dateTime || '');
  t('evVenue',    info.venue || '');
  t('evAddress',  info.address || '');
  t('evBus',      info.bus || '');
  t('evTrain',    info.train || '');
  t('evParking',  info.parking || '');
  t('evNotes',    info.notes || '');

  const mapBtn = document.getElementById('mapBtn');
  if (info.mapUrl) mapBtn.href = info.mapUrl; else mapBtn.style.display='none';
}

document.addEventListener('DOMContentLoaded', boot);