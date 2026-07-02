// settings.js — UI-editable settings, stored in localStorage and deep-merged
// over the CONFIG defaults from config.js at boot. Also applies per-tile
// rename/hide. Loaded after config.js, before app.js.
(function () {
  "use strict";
  const KEY = "opendash_settings_v1";

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}

  // Deep merge: objects merge, arrays and scalars replace wholesale.
  function merge(base, over) {
    Object.keys(over).forEach((k) => {
      if (over[k] && typeof over[k] === "object" && !Array.isArray(over[k]) &&
          base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
        merge(base[k], over[k]);
      } else {
        base[k] = over[k];
      }
    });
  }
  merge(CONFIG, saved);
  const tiles = saved.tiles || {};

  // Tile id → section element id. Tile ids double as CONFIG keys.
  const TILES = {
    weather:    "weather-section",
    rss:        "rss-section",
    vacation:   "vacation-section",
    today:      "today-section",
    health:     "health-section",
    scratchpad: "scratchpad-section",
  };

  // Apply rename + hide before app.js wires the widgets.
  Object.keys(TILES).forEach((id) => {
    const t = tiles[id] || {};
    const sec = document.getElementById(TILES[id]);
    if (!sec) return;
    // vacation's title IS its label (set by app.js from CONFIG.vacation.label)
    if (t.title && id !== "vacation") {
      const titleEl = sec.querySelector(".panel-title");
      if (titleEl) titleEl.textContent = t.title;
    }
    if (t.hidden) {
      if (!CONFIG[id]) CONFIG[id] = {};
      CONFIG[id].enabled = false;
      sec.classList.add("hidden");
    }
  });

  // ── Settings modal ─────────────────────────────────────────
  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function tileHeader(id, label) {
    const t = tiles[id] || {};
    return `<div class="settings-tile-hdr">
      <span class="settings-tile-name">${label}</span>
      <input class="finance-input settings-title" id="s-title-${id}" type="text"
             placeholder="Rename tile…" value="${esc(t.title || "")}" ${id === "vacation" ? "hidden" : ""} />
      <label class="settings-hide"><input type="checkbox" id="s-hide-${id}" ${t.hidden ? "checked" : ""}/> hide</label>
    </div>`;
  }

  const dlg = document.createElement("dialog");
  dlg.id = "settings-dialog";
  dlg.innerHTML = `
    <form method="dialog" id="settings-form">
      <h2 class="settings-h">Settings</h2>

      <div class="settings-section">
        <div class="settings-tile-hdr"><span class="settings-tile-name">General</span></div>
        <label class="finance-form-label">Your name</label>
        <input class="finance-input" id="s-name" type="text" value="${esc(CONFIG.name)}" />
        <label class="finance-form-label">Greeting ({time} and {name} are replaced)</label>
        <input class="finance-input" id="s-greeting" type="text" value="${esc(CONFIG.greeting)}" />
      </div>

      <div class="settings-section">
        ${tileHeader("weather", "Weather")}
        <label class="finance-form-label">Locations — one per line: Name, latitude, longitude</label>
        <textarea class="finance-input settings-ta" id="s-weather-locs" rows="4"></textarea>
      </div>

      <div class="settings-section">
        ${tileHeader("rss", "News")}
        <label class="finance-form-label">RSS feeds — one per line: Name, url</label>
        <textarea class="finance-input settings-ta" id="s-feeds" rows="5"></textarea>
      </div>

      <div class="settings-section">
        ${tileHeader("vacation", "Until… countdown")}
        <label class="finance-form-label">Label</label>
        <input class="finance-input" id="s-until-label" type="text" value="${esc(CONFIG.vacation.label)}" />
        <label class="finance-form-label">Date</label>
        <input class="finance-input" id="s-until-date" type="date" value="${esc(CONFIG.vacation.date)}" />
      </div>

      <div class="settings-section">
        ${tileHeader("today", "Today")}
      </div>

      <div class="settings-section">
        ${tileHeader("health", "Services")}
        <label class="finance-form-label">Services to ping — one per line: Name, url</label>
        <textarea class="finance-input settings-ta" id="s-services" rows="4"></textarea>
      </div>

      <div class="settings-section">
        ${tileHeader("scratchpad", "Scratchpad")}
        <label class="finance-form-label">Embed URL (empty = plain textarea)</label>
        <input class="finance-input" id="s-scratchpad-url" type="text" value="${esc(CONFIG.scratchpad.url)}" />
      </div>

      <div class="settings-actions">
        <button type="button" class="toolbar-btn toolbar-btn-danger" id="s-reset">Reset to defaults</button>
        <span class="settings-actions-spacer"></span>
        <button type="button" class="toolbar-btn" id="s-cancel">Cancel</button>
        <button type="button" class="toolbar-btn" id="s-save">Save &amp; reload</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);

  const $ = (id) => document.getElementById(id);

  // Prefill textareas (multi-line values don't survive as HTML attributes)
  $("s-weather-locs").value = (CONFIG.weather.locations || [])
    .map((l) => `${l.name}, ${l.lat}, ${l.lon}`).join("\n");
  $("s-feeds").value = (CONFIG.rss.feeds || [])
    .map((f) => `${f.name}, ${f.url}`).join("\n");
  $("s-services").value = (CONFIG.health.services || [])
    .map((s) => `${s.name}, ${s.url}`).join("\n");

  function lines(v) { return v.split("\n").map((s) => s.trim()).filter(Boolean); }
  // "Name, rest" — split on the FIRST comma so urls stay intact
  function nameRest(line) {
    const i = line.indexOf(",");
    if (i === -1) return null;
    return { name: line.slice(0, i).trim(), rest: line.slice(i + 1).trim() };
  }

  $("s-save").addEventListener("click", () => {
    const locations = lines($("s-weather-locs").value).map((line) => {
      const p = line.split(",").map((s) => s.trim());
      return p.length >= 3 ? { name: p[0], lat: +p[1], lon: +p[2] } : null;
    }).filter((l) => l && l.name && !isNaN(l.lat) && !isNaN(l.lon));

    const feeds = lines($("s-feeds").value).map(nameRest)
      .filter((f) => f && f.name && /^https?:\/\//.test(f.rest))
      .map((f) => ({ name: f.name, url: f.rest }));

    const services = lines($("s-services").value).map(nameRest)
      .filter((s) => s && s.name && /^https?:\/\//.test(s.rest))
      .map((s) => ({ name: s.name, url: s.rest }));

    const tilesOut = {};
    Object.keys(TILES).forEach((id) => {
      const title = id === "vacation" ? "" : $("s-title-" + id).value.trim();
      const hidden = $("s-hide-" + id).checked;
      if (title || hidden) tilesOut[id] = { title: title || undefined, hidden: hidden || undefined };
    });

    const blob = {
      name:     $("s-name").value.trim() || "there",
      greeting: $("s-greeting").value.trim() || "Good {time}, {name}",
      weather:  { locations },
      rss:      { feeds },
      vacation: { label: $("s-until-label").value.trim(), date: $("s-until-date").value },
      health:   { services },
      scratchpad: { url: $("s-scratchpad-url").value.trim() },
      tiles: tilesOut,
    };
    localStorage.setItem(KEY, JSON.stringify(blob));
    location.reload(); // ponytail: reload instead of live re-render — every widget re-reads CONFIG at boot
  });

  $("s-cancel").addEventListener("click", () => dlg.close());
  $("s-reset").addEventListener("click", () => {
    if (!confirm("Reset all settings to config.js defaults?")) return;
    localStorage.removeItem(KEY);
    location.reload();
  });

  document.getElementById("settings-btn").addEventListener("click", () => dlg.showModal());
})();
