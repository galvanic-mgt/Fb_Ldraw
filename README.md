# Lucky Draw (Firebase Modular Build)

This is a from-scratch, modular rewrite of your app that preserves the same features but splits logic into focused ES modules (7–10 files). **All cloud reads/writes use a single, centralized Firebase RTDB base**, configured in `src/config.js`.

## Change Firebase once
Open `src/config.js` and edit:
```js
export const CONFIG = {
  firebaseBase: "https://luckydrawpolls-default-rtdb.asia-southeast1.firebasedatabase.app"
};
```
That updates the entire app (CMS, landing, vote).

## Files
- `src/config.js` – one-stop Firebase base
- `src/fb.js` – tiny REST wrapper (GET/PUT/PATCH)
- `src/state.js` – local event state (STORE_KEY, snapshots)
- `src/events.js` – create/clone, cloud index upsert/pull
- `src/roster.js` – roster helpers
- `src/prizes.js` – prize CRUD and counters
- `src/stage.js` – draw logic and batch selection
- `src/poll.js` – poll editor + publish to Firebase
- `src/ui.js` – wires CMS UI controls
- `src/main.js` – entry; exposes `renderAll()` for login module
- `src/login-local.js` – local-only auth (same as before)
- `src/landing.mod.js` – landing page (reads event info from Firebase)
- `src/vote.mod.js` – phone vote page (writes votes to Firebase)

The bundled HTML pages (`index.html`, `landing.html`, `vote.html`) load ES modules via `<script type="module">`.

## How to run
Just open `index.html` with a static server (or directly from disk in modern browsers). For phone voting, the link pattern remains:
```
/vote.html?event=<EVENT_ID>&poll=<POLL_ID>
```