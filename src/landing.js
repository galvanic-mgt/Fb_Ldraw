// landing.js — event landing page (check-in + event visuals)
// Standalone file: uses Firebase Realtime Database REST API directly, no imports.

// === CONFIG ===
// NOTE: this should match src/config.js.
const FIREBASE_BASE = "https://eva-lucky-draw-default-rtdb.asia-southeast1.firebasedatabase.app";

// Helper to build URLs like `${FIREBASE_BASE}/events/e123/info.json`
function dbUrl(path) {
  const p = path.startsWith("/") ? path : "/" + path;
  return FIREBASE_BASE.replace(/\/$/, "") + p + ".json";
}

async function dbGet(path) {
  const res = await fetch(dbUrl(path));
  if (!res.ok) {
    throw new Error("Firebase GET failed: " + res.status + " " + res.statusText);
  }
  return res.json();
}

// PATCH merges with existing node
async function dbPatch(path, body) {
  const res = await fetch(dbUrl(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) {
    throw new Error("Firebase PATCH failed: " + res.status + " " + res.statusText);
  }
  return res.json();
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Normalise: digits-only for phone; lowercased trimmed for text/code
function normaliseDigits(s) {
  return String(s || "").replace(/\D+/g, "");
}
function normaliseText(s) {
  return String(s || "").trim().toLowerCase();
}

// ---- Event info + visuals ----
async function loadEventHeader(eid) {
  // Load info (title / date-time / venue / address / transport / notes)
  const info = (await dbGet(`/events/${eid}/info`)) || {};

  const $ = (id) => document.getElementById(id);

  if ($("evTitle"))     $("evTitle").textContent    = info.title    || "活動";
  if ($("evDateTime"))  $("evDateTime").textContent = info.dateTime || "";
  if ($("evVenue"))     $("evVenue").textContent    = info.venue    || "";
  if ($("evAddress"))   $("evAddress").textContent  = info.address  || "";

  if ($("evBus"))       $("evBus").textContent      = info.bus      || "";
  if ($("evTrain"))     $("evTrain").textContent    = info.train    || "";
  if ($("evParking"))   $("evParking").textContent  = info.parking  || "";

  // Hide empty transport blocks
  const hasBus     = Boolean((info.bus || '').trim());
  const hasTrain   = Boolean((info.train || '').trim());
  const hasParking = Boolean((info.parking || '').trim());
  const busBlock     = document.getElementById('busBlock');
  const trainBlock   = document.getElementById('trainBlock');
  const parkingBlock = document.getElementById('parkingBlock');
  if (busBlock)     busBlock.style.display     = hasBus ? '' : 'none';
  if (trainBlock)   trainBlock.style.display   = hasTrain ? '' : 'none';
  if (parkingBlock) parkingBlock.style.display = hasParking ? '' : 'none';
  if ($("evNotes"))     $("evNotes").textContent    = info.notes    || "";
  // Dynamic labels for check-in
  const labelPhone = info.labelPhone || "電話";
  const labelDept  = info.labelDept  || "代號";
  const titleEl = document.getElementById("checkinTitle");
  const labelEl = document.getElementById("checkinLabel");
  const inputEl = document.getElementById("codeDigits");
  if (titleEl) titleEl.textContent = `到場報到（輸入${labelPhone}或${labelDept}）`;
  if (labelEl) labelEl.textContent = `${labelPhone} / ${labelDept}`;
  if (inputEl) inputEl.placeholder = `請輸入你的${labelPhone}或${labelDept}`;

  if ($("mapBtn")) {
    const url = info.mapUrl || "";
    $("mapBtn").style.display = url ? "inline-flex" : "none";
    if (url) $("mapBtn").href = url;
  }

  // Load assets for logo / banner / background.
  const [
    logoUrl,
    bannerUrl,
    photos
  ] = await Promise.all([
    dbGet(`/events/${eid}/logo`),
    dbGet(`/events/${eid}/banner`),
    dbGet(`/events/${eid}/photos`)
  ]);

  const bannerEl = document.getElementById("banner");
  const logoEl   = document.getElementById("logo");

  const finalLogo   = logoUrl   || "";
  const finalBanner = bannerUrl || "";
  let   finalBg     = "";

  if (!finalBg) {
    if (Array.isArray(photos) && photos.length > 0) {
      // assume photos[] is array of URL strings
      finalBg = photos[0];
    } else {
      finalBg = finalBanner;
    }
  }

  if (logoEl && finalLogo) {
    logoEl.src = finalLogo;
    logoEl.style.display = "block";
  }

  if (bannerEl && finalBanner) {
    bannerEl.style.backgroundImage = `url('${finalBanner}')`;
    bannerEl.style.display = "block";
  }

  // Page background with 25% dark overlay
  if (finalBg) {
    const dim = 0.25;
    document.body.style.backgroundImage =
      `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url('${finalBg}')`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center center";
  }
}

// ---- Guest check-in (phone OR code) ----
function attachCheckin(eid) {
  const form       = document.getElementById("checkinForm");
  const input      = document.getElementById("codeDigits");
  const msgEl      = document.getElementById("checkinMsg");
  const seatCard   = document.getElementById("seatCard");
  const seatInfoEl = document.getElementById("seatInfo");

  if (!form || !input) return;

  function showMessage(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.style.color = isError ? "#ff5a67" : "";
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();

    const raw = input.value.trim();
    if (!raw) {
      showMessage("請輸入電話或代碼。", true);
      return;
    }

    showMessage("查詢中…", false);
    if (seatCard) seatCard.style.display = "none";
    if (seatInfoEl) seatInfoEl.textContent = "";

    try {
      const people = (await dbGet(`/events/${eid}/people`)) || [];
      if (!Array.isArray(people) || people.length === 0) {
        showMessage("找不到名單，請向職員查詢。", true);
        return;
      }

      const digits = normaliseDigits(raw);
      const text   = normaliseText(raw);

      let foundIndex = -1;
      let found      = null;

      for (let i = 0; i < people.length; i++) {
        const p = people[i];
        if (!p) continue;

        const pPhoneDigits = normaliseDigits(p.phone);
        const pCodeText    = normaliseText(p.code);

        const matchPhone = digits && pPhoneDigits && pPhoneDigits === digits;
        const matchCode  = text && pCodeText && pCodeText === text;

        if (matchPhone || matchCode) {
          foundIndex = i;
          found = p;
          break;
        }
      }

      if (foundIndex === -1 || !found) {
        showMessage("找不到相符的記錄，請檢查輸入或向職員查詢。", true);
        return;
      }

      // Mark as present (checkedIn = true)
      await dbPatch(`/events/${eid}/people/${foundIndex}`, { checkedIn: true });

      const name    = found.name || "";
      const table   = found.table || "";
      const seat    = found.seat || "";
      const seatStr = (table || seat)
        ? [table ? `枱：${table}` : "", seat ? `座位：${seat}` : ""]
            .filter(Boolean)
            .join(" · ")
        : "";

      showMessage(`✅ 已為 ${name || "來賓"} 登記出席，歡迎！`, false);

      if (seatCard && seatInfoEl) {
        if (seatStr) {
          seatInfoEl.textContent = seatStr;
          seatCard.style.display = "block";
        } else {
          seatCard.style.display = "none";
        }
      }

      // Optional: clear input after success
      input.value = "";

    } catch (err) {
      console.error("Check-in failed", err);
      showMessage("系統錯誤，請稍後再試或向職員查詢。", true);
    }
  });
}

// ---- Boot ----
async function bootLanding() {
  // event ID comes from ?event=xxx (same as Public Board)
  const eid = getQueryParam("event") || getQueryParam("eid");

  if (!eid) {
    console.warn("No event ID in URL (?event=...) – landing page cannot bind to an event.");
    const msgEl = document.getElementById("checkinMsg");
    if (msgEl) {
      msgEl.textContent = "（缺少活動編號，請從正確 QR Code 開啟此頁。）";
    }
    return;
  }

  try {
    await loadEventHeader(eid);
  } catch (err) {
    console.error("Failed to load event info", err);
    const msgEl = document.getElementById("checkinMsg");
    if (msgEl) {
      msgEl.textContent = "載入活動資料時出錯，請稍後再試。";
    }
  }

  attachCheckin(eid);
}

document.addEventListener("DOMContentLoaded", bootLanding);
