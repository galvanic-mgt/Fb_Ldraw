export function currentStageUrl(eid){ return `${location.origin}${location.pathname.replace(/\/[^/]*$/,'/') }public.html?event=${encodeURIComponent(eid)}`; }
export function currentTabletUrl(eid){ return `${location.origin}${location.pathname.replace(/\/[^/]*$/,'/') }tablet.html?event=${encodeURIComponent(eid)}`; }
export function currentQRUrl(eid){ return `${location.origin}${location.pathname.replace(/\/[^/]*$/,'/') }landing.html?event=${encodeURIComponent(eid)}`; }
export function showPublic(){ document.body.classList.add('public-open'); }
export function closePublic(){ document.body.classList.remove('public-open'); }
export function showTablet(){ document.body.classList.add('tablet-open'); }
export function closeTablet(){ document.body.classList.remove('tablet-open'); }
export function updatePublicPanel(){}
export function renderPublic(){}
export function updateLandingLink(){}
export function updateFullStageLink(){}
export function renderLandingLink(){}