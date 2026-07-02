// app.js — wires all widgets from CONFIG (config.js, merged with UI settings by settings.js)
(function () {
  const cfg = CONFIG;

  // ── Helpers ────────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ── Cross-tab sync hooks (set by each widget, used by storage listener) ──
  let _renderTodos = null;
  let _syncPomo    = null;

  // ── Service Worker (background pomodoro notifications) ─────
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  function swPost(msg) {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => { if (reg.active) reg.active.postMessage(msg); })
      .catch(() => {});
  }

  // ── Collapsible panels ─────────────────────────────────────
  function initCollapse(panelId, defaultCollapsed) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const header = panel.querySelector(".panel-header");
    if (!header) return;
    const key    = "dash-c-" + panelId;
    const stored = localStorage.getItem(key);
    if (stored !== null ? stored === "1" : !!defaultCollapsed)
      panel.classList.add("collapsed");
    header.addEventListener("click", (e) => {
      if (e.target.closest("button, input, a")) return;
      panel.classList.toggle("collapsed");
      localStorage.setItem(key, panel.classList.contains("collapsed") ? "1" : "0");
    });
  }

  // ── Background ─────────────────────────────────────────────
  const bg = cfg.background;
  if (bg.type === "color")    document.body.style.background = bg.color;
  if (bg.type === "gradient") document.body.style.background = bg.gradient;
  if (bg.type === "image")
    document.body.style.background = `url('${bg.image}') center/cover no-repeat fixed`;

  // ── Page title ─────────────────────────────────────────────
  document.getElementById("page-title").textContent = cfg.title;

  // ── Clock & date ───────────────────────────────────────────
  const clockEl    = document.getElementById("clock");
  const dateEl     = document.getElementById("date");
  const clockBlock = document.getElementById("clock-block");

  if (!cfg.showClock && !cfg.showDate) clockBlock.classList.add("hidden");
  if (!cfg.showClock) clockEl.classList.add("hidden");
  if (!cfg.showDate)  dateEl.classList.add("hidden");

  function tickClock() {
    const now = new Date();
    if (cfg.showClock)
      clockEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (cfg.showDate)
      dateEl.textContent = now.toLocaleDateString([], {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ── Greeting ───────────────────────────────────────────────
  const h = new Date().getHours();
  const timeOfDay = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  document.getElementById("greeting").textContent = cfg.greeting
    .replace("{time}", timeOfDay).replace("{name}", cfg.name);

  // ── Search ─────────────────────────────────────────────────
  if (!cfg.search.enabled) {
    document.getElementById("search-section").classList.add("hidden");
  } else {
    const input     = document.getElementById("search-input");
    const btnDDG    = document.getElementById("engine-ddg");
    const btnGoogle = document.getElementById("engine-google");
    const btnAI     = document.getElementById("search-ai-toggle");
    const btnPriv   = document.getElementById("search-private-toggle");

    const cfgEngine = cfg.search.engine === "google" ? "google" : "ddg";
    let engine = localStorage.getItem("search-engine");
    if (engine !== "ddg" && engine !== "google") engine = cfgEngine;
    let aiOn   = localStorage.getItem("search-ai")      === "on";   // default off
    let privOn = localStorage.getItem("search-private") !== "off";  // default on

    function buildSearchUrl(q) {
      const enc = encodeURIComponent(q);
      if (engine === "ddg") {
        // AI toggle opens DDG AI chat; otherwise standard web search
        return "https://duckduckgo.com/?q=" + enc + (aiOn ? "&ia=chat" : "");
      }
      // Google: AI off -> web-only tab (udm=14, suppresses AI Overview)
      //         Private on -> pws=0 (disables personalisation)
      let url = "https://www.google.com/search?q=" + enc;
      if (!aiOn)  url += "&udm=14";
      if (privOn) url += "&pws=0";
      return url;
    }

    function updateSearchUI() {
      btnDDG.classList.toggle("active",    engine === "ddg");
      btnGoogle.classList.toggle("active", engine === "google");
      btnAI.classList.toggle("active", aiOn);
      // Private: always-on indicator for DDG (inherently private)
      const ddgSelected = engine === "ddg";
      btnPriv.classList.toggle("active",    ddgSelected || privOn);
      btnPriv.classList.toggle("always-on", ddgSelected);
    }

    btnDDG.addEventListener("click", () => {
      engine = "ddg"; localStorage.setItem("search-engine", engine);
      updateSearchUI(); input.focus();
    });
    btnGoogle.addEventListener("click", () => {
      engine = "google"; localStorage.setItem("search-engine", engine);
      updateSearchUI(); input.focus();
    });
    btnAI.addEventListener("click", () => {
      aiOn = !aiOn; localStorage.setItem("search-ai", aiOn ? "on" : "off");
      updateSearchUI(); input.focus();
    });
    btnPriv.addEventListener("click", () => {
      if (engine === "ddg") return; // locked on
      privOn = !privOn; localStorage.setItem("search-private", privOn ? "on" : "off");
      updateSearchUI(); input.focus();
    });

    input.placeholder = cfg.search.placeholder;
    document.getElementById("search-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      const url = buildSearchUrl(q);
      cfg.search.openInNewTab ? window.open(url, "_blank") : (location.href = url);
      input.value = "";
    });

    updateSearchUI();
    input.focus();
  }

  // ── Weather ────────────────────────────────────────────────
  const wcfg = cfg.weather;

  if (wcfg?.enabled && wcfg.locations?.length) {
    const weatherSection = document.getElementById("weather-section");
    const weatherStatus  = document.getElementById("weather-status");
    const weatherGrid    = document.getElementById("weather-grid");
    const pillsContainer = document.getElementById("weather-pills");

    weatherSection.classList.remove("hidden");
    initCollapse("weather-section");

    let activeCities = (() => {
      try {
        const s = localStorage.getItem("weather-cities");
        return s ? new Set(JSON.parse(s)) : new Set(wcfg.locations.map((_, i) => i));
      } catch { return new Set(wcfg.locations.map((_, i) => i)); }
    })();
    // Locations are editable in settings — drop stale indices
    activeCities = new Set([...activeCities].filter((i) => i < wcfg.locations.length));
    if (!activeCities.size) activeCities = new Set(wcfg.locations.map((_, i) => i));

    function saveActiveCities() {
      localStorage.setItem("weather-cities", JSON.stringify([...activeCities]));
    }

    function wmoEmoji(code) {
      if (code === 0)  return "☀️";
      if (code <= 2)   return "🌤️";
      if (code === 3)  return "☁️";
      if (code <= 48)  return "🌫️";
      if (code <= 55)  return "🌦️";
      if (code <= 67)  return "🌧️";
      if (code <= 77)  return "❄️";
      if (code <= 82)  return "🌦️";
      if (code <= 86)  return "❄️";
      return "⛈️";
    }

    function localHour() {
      // sv-SE toLocaleString gives "YYYY-MM-DD HH:MM:SS" reliably across browsers
      return new Date().toLocaleString("sv-SE").slice(0, 13).replace(" ", "T");
    }

    async function fetchCity(loc) {
      const p = new URLSearchParams({
        latitude: loc.lat, longitude: loc.lon,
        hourly: "temperature_2m,weathercode,precipitation_probability",
        timezone: "auto", forecast_days: 2,
      });
      const data = await (await fetch(`https://api.open-meteo.com/v1/forecast?${p}`)).json();
      const cur  = localHour();
      let idx    = data.hourly.time.findIndex((t) => t.startsWith(cur));
      if (idx === -1) idx = 0;
      return (wcfg.offsets || [0, 2, 5, 10]).map((off) => {
        const i = Math.min(idx + off, data.hourly.time.length - 1);
        return {
          temp: Math.round(data.hourly.temperature_2m[i]),
          code: data.hourly.weathercode[i],
          rain: data.hourly.precipitation_probability[i],
        };
      });
    }

    let weatherCache = null;

    function renderWeatherRows() {
      weatherGrid.querySelectorAll(".w-row").forEach((r) => r.remove());
      if (!weatherCache) return;

      weatherCache.forEach(({ loc, slots, error }, idx) => {
        if (!activeCities.has(idx)) return;
        const row = document.createElement("div");
        row.className = "w-row";

        const name = document.createElement("div");
        name.className   = "w-city-name";
        name.textContent = loc.name;
        row.appendChild(name);

        (wcfg.offsets || [0, 2, 5, 10]).forEach((_, i) => {
          const cell = document.createElement("div");
          cell.className = "w-slot";
          if (error || !slots) {
            cell.innerHTML = `<span style="opacity:.3;font-size:.7rem">—</span>`;
          } else {
            const s = slots[i];
            cell.innerHTML = `<span class="w-icon">${wmoEmoji(s.code)}</span>`
              + `<span class="w-temp">${s.temp}°</span>`
              + `<span class="w-rain">${s.rain ?? "—"}%</span>`;
          }
          row.appendChild(cell);
        });

        weatherGrid.appendChild(row);
      });
    }

    function renderPills() {
      pillsContainer.innerHTML = "";
      wcfg.locations.forEach((loc, i) => {
        const btn = document.createElement("button");
        btn.className   = "city-pill" + (activeCities.has(i) ? " active" : "");
        btn.textContent = loc.name;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (activeCities.has(i)) {
            if (activeCities.size > 1) activeCities.delete(i);
          } else {
            activeCities.add(i);
          }
          saveActiveCities();
          renderPills();
          renderWeatherRows();
        });
        pillsContainer.appendChild(btn);
      });
    }

    async function loadWeather() {
      weatherGrid.querySelectorAll(".w-row").forEach((r) => r.remove());
      const loading = document.createElement("div");
      loading.className   = "w-loading";
      loading.textContent = "Loading…";
      weatherGrid.appendChild(loading);

      weatherCache = await Promise.all(
        wcfg.locations.map(async (loc) => {
          try   { return { loc, slots: await fetchCity(loc), error: null }; }
          catch (e) { return { loc, slots: null, error: e.message }; }
        })
      );

      loading.remove();
      renderWeatherRows();
      weatherStatus.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    renderPills();
    loadWeather();
    setInterval(loadWeather, (wcfg.refreshMinutes || 30) * 60 * 1000);
  }

  // ── "Until…" Countdown ─────────────────────────────────────
  const vac = cfg.vacation;
  const vacSection = document.getElementById("vacation-section");

  if (!vac?.enabled || !vac.date) {
    vacSection.classList.add("hidden");
  } else {
    vacSection.classList.remove("hidden");
    document.getElementById("vacation-label").textContent = vac.label;
    const target = new Date(vac.date + "T00:00:00");
    const daysEl = document.getElementById("vac-days");
    const hrsEl  = document.getElementById("vac-hours");
    const minEl  = document.getElementById("vac-minutes");
    const secEl  = document.getElementById("vac-seconds");

    function tickVac() {
      const diff = target - Date.now();
      if (diff <= 0) {
        daysEl.textContent = hrsEl.textContent = minEl.textContent = secEl.textContent = "00";
        return;
      }
      const s = Math.floor(diff / 1000);
      daysEl.textContent = Math.floor(s / 86400);
      hrsEl.textContent  = pad(Math.floor((s % 86400) / 3600));
      minEl.textContent  = pad(Math.floor((s % 3600) / 60));
      secEl.textContent  = pad(s % 60);
    }
    tickVac();
    setInterval(tickVac, 1000);
    initCollapse("vacation-section");
  }

  // ── Today: simple task list + standalone Pomodoro ──────────
  const todaySection = document.getElementById("today-section");

  if (cfg.today?.enabled === false) {
    todaySection.classList.add("hidden");
  } else {
    const TASKS_KEY  = "opendash_tasks_v1";
    const todayList  = document.getElementById("today-list");
    const todayEmpty = document.getElementById("today-empty");
    const addForm    = document.getElementById("today-add-form");
    const addInput   = document.getElementById("today-add-input");

    function loadTasks() {
      try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; } catch { return []; }
    }
    function saveTasks(tasks) { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }

    function renderTasks() {
      const tasks = loadTasks();
      todayList.innerHTML = "";
      todayEmpty.classList.toggle("hidden", tasks.length > 0);
      tasks.forEach((t) => {
        const li = document.createElement("li");
        li.className = "today-item" + (t.done ? " today-done" : "");
        li.innerHTML = `
          <input type="checkbox" class="today-check" ${t.done ? "checked" : ""} title="Done" />
          <span class="today-item-body"><span class="today-item-title">${esc(t.text)}</span></span>
          <button class="today-del" title="Delete">✕</button>`;
        li.querySelector(".today-check").addEventListener("change", () => {
          const ts = loadTasks();
          const x  = ts.find((x) => x.id === t.id);
          if (x) { x.done = !x.done; saveTasks(ts); }
          renderTasks();
        });
        li.querySelector(".today-del").addEventListener("click", () => {
          saveTasks(loadTasks().filter((x) => x.id !== t.id));
          renderTasks();
        });
        todayList.appendChild(li);
      });
    }

    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = addInput.value.trim();
      if (!text) return;
      const tasks = loadTasks();
      tasks.push({ id: uid(), text, done: false });
      saveTasks(tasks);
      addInput.value = "";
      renderTasks();
    });

    _renderTodos = renderTasks;
    renderTasks();

    // ── Pomodoro (independent of the task list) ──
    const pomoWrap = document.getElementById("today-pomo-wrap");

    if (cfg.pomodoro?.enabled === false) {
      pomoWrap.classList.add("hidden");
    } else {
      const pomoCfg    = cfg.pomodoro;
      const WORK       = (pomoCfg?.workMinutes       ?? 25) * 60;
      const SHORT      = (pomoCfg?.shortBreakMinutes ?? 5)  * 60;
      const LONG       = (pomoCfg?.longBreakMinutes  ?? 15) * 60;
      const LONG_AFTER = pomoCfg?.longBreakAfter ?? 4;
      const POMO_KEY   = "pomo-state";

      const pomoFill    = document.getElementById("today-pomo-fill");
      const pomoPhase   = document.getElementById("today-pomo-phase");
      const pomoDisplay = document.getElementById("today-pomo-display");
      const pomoCycles  = document.getElementById("today-pomo-cycles");
      const pomoToggle  = document.getElementById("today-pomo-toggle");
      const pomoSkip    = document.getElementById("today-pomo-skip");
      const pomoReset   = document.getElementById("today-pomo-reset");

      function loadPomoSaved() { try { return JSON.parse(localStorage.getItem(POMO_KEY)) || null; } catch { return null; } }
      function savePomo(s)     { localStorage.setItem(POMO_KEY, JSON.stringify(s)); }
      function defaultPomo()   { return { phase: "idle", cycles: 0, endAt: null, remaining: WORK, totalTime: WORK }; }
      function advancePhase(s, autoStart) {
        const ns = { ...s };
        if (ns.phase !== "break") {
          ns.cycles++; ns.phase = "break";
          ns.totalTime = ns.remaining = (ns.cycles % LONG_AFTER === 0) ? LONG : SHORT;
        } else {
          ns.phase = "work"; ns.totalTime = ns.remaining = WORK;
        }
        ns.endAt = autoStart ? Date.now() + ns.remaining * 1000 : null;
        return ns;
      }

      let ps = defaultPomo();
      const _saved = loadPomoSaved();
      if (_saved) {
        if (_saved.endAt) {
          const now = Date.now();
          if (now >= _saved.endAt) { ps = advancePhase(_saved, false); savePomo(ps); }
          else ps = { ..._saved, remaining: Math.ceil((_saved.endAt - now) / 1000) };
        } else { ps = _saved; }
      }

      let tickTimer = null;

      function scheduleNotif() {
        if (!ps.endAt) return;
        swPost({ type: "POMO_SCHEDULE", endAt: ps.endAt, body: ps.phase === "work" ? "Break time! 🎉" : "Back to work! 💪" });
      }
      function cancelNotif() { swPost({ type: "POMO_CANCEL" }); }

      function startTick() {
        if (tickTimer) return;
        tickTimer = setInterval(() => {
          if (!ps.endAt) { stopTick(); return; }
          renderPomoBar();
          if (Date.now() >= ps.endAt) {
            if (Notification.permission === "granted") {
              try { new Notification("Pomodoro", { body: ps.phase === "work" ? "Break time!" : "Back to work!", tag: "pomo" }); } catch {}
            }
            ps = advancePhase(ps, true);
            savePomo(ps); scheduleNotif(); renderPomoBar();
          }
        }, 500);
      }
      function stopTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

      function renderPomoBar() {
        const secsLeft = ps.endAt ? Math.max(0, Math.ceil((ps.endAt - Date.now()) / 1000)) : ps.remaining;
        pomoDisplay.textContent = pad(Math.floor(secsLeft / 60)) + ":" + pad(secsLeft % 60);
        pomoFill.style.width = (ps.totalTime > 0 ? (ps.totalTime - secsLeft) / ps.totalTime * 100 : 0) + "%";
        pomoFill.className   = ps.phase === "break" ? "break" : "";
        pomoPhase.textContent = ps.phase === "break"
          ? (ps.cycles % LONG_AFTER === 0 ? "Long Break" : "Short Break") : "Work";
        pomoCycles.textContent = Array.from({ length: LONG_AFTER }, (_, i) =>
          i < (ps.cycles % LONG_AFTER) ? "●" : "○").join("");
        pomoToggle.textContent = ps.endAt ? "⏸" : "▶";
        pomoToggle.classList.toggle("running", !!ps.endAt);
      }

      pomoToggle.addEventListener("click", () => {
        if (Notification.permission === "default") Notification.requestPermission();
        if (ps.endAt) {
          ps.remaining = Math.max(1, Math.ceil((ps.endAt - Date.now()) / 1000));
          ps.endAt = null; cancelNotif(); stopTick();
        } else {
          if (ps.phase === "idle") ps.phase = "work";
          ps.endAt = Date.now() + ps.remaining * 1000;
          scheduleNotif(); startTick();
        }
        savePomo(ps); renderPomoBar();
      });
      pomoSkip.addEventListener("click", () => {
        const was = !!ps.endAt;
        ps = advancePhase(ps, was); savePomo(ps);
        if (was) { scheduleNotif(); startTick(); } else cancelNotif();
        renderPomoBar();
      });
      pomoReset.addEventListener("click", () => {
        cancelNotif(); stopTick();
        ps = defaultPomo(); savePomo(ps); renderPomoBar();
      });

      // Cross-tab pomo sync
      function syncPomoFromStorage() {
        stopTick();
        const saved = loadPomoSaved();
        if (!saved) { ps = defaultPomo(); }
        else if (saved.endAt) {
          const now = Date.now();
          if (now >= saved.endAt) { ps = advancePhase(saved, false); savePomo(ps); }
          else ps = { ...saved, remaining: Math.ceil((saved.endAt - now) / 1000) };
        } else { ps = saved; }
        if (ps.endAt) startTick();
        renderPomoBar();
      }
      _syncPomo = syncPomoFromStorage;

      if (ps.endAt) startTick();
      renderPomoBar();
    }

    initCollapse("today-section");
  }

  // ── Service Health ─────────────────────────────────────────
  const hcfg          = cfg.health;
  const healthSection = document.getElementById("health-section");

  if (!hcfg?.enabled) {
    healthSection.classList.add("hidden");
  } else {
    healthSection.classList.remove("hidden");

    if (!hcfg.services?.length) {
      document.getElementById("health-empty").classList.remove("hidden");
    } else {
      const healthList = document.getElementById("health-list");

      async function ping(svc) {
        try {
          const r = await (await fetch("/ping?url=" + encodeURIComponent(svc.url))).json();
          return { ...svc, ok: r.ok, ms: r.ms, err: r.error || null };
        } catch (e) {
          return { ...svc, ok: false, ms: 0, err: e.message };
        }
      }

      function renderHealth(results) {
        healthList.innerHTML = "";
        results.forEach((r) => {
          const el = document.createElement("div");
          el.className = "health-item";
          el.innerHTML = `<div class="health-dot ${r.ok ? "up" : "down"}"></div>`
            + `<span class="health-name">${esc(r.name)}</span>`
            + `<span class="health-meta">${r.ok ? r.ms + "ms" : (r.err || "down")}</span>`;
          healthList.appendChild(el);
        });
      }

      async function checkHealth() {
        renderHealth(await Promise.all(hcfg.services.map(ping)));
      }

      checkHealth();
      setInterval(checkHealth, (hcfg.refreshMinutes || 5) * 60 * 1000);
      document.getElementById("health-refresh").addEventListener("click", (e) => {
        e.stopPropagation(); checkHealth();
      });
    }

    initCollapse("health-section");
  }

  // ── Scratchpad ─────────────────────────────────────────────
  const scCfg     = cfg.scratchpad;
  const scSection = document.getElementById("scratchpad-section");
  const scBody    = document.getElementById("scratchpad-body");

  if (!scCfg?.enabled) {
    scSection.classList.add("hidden");
  } else {
    scSection.classList.remove("hidden");

    if (scCfg.url) {
      const frame = document.createElement("iframe");
      frame.id    = "scratchpad-frame";
      frame.src   = scCfg.url;
      frame.allow = "fullscreen";
      scBody.appendChild(frame);
    } else {
      const ta           = document.createElement("textarea");
      ta.id              = "scratchpad-textarea";
      ta.placeholder     = "Jot anything down…";
      ta.value           = localStorage.getItem("dashboard-scratchpad") || "";
      ta.addEventListener("input", () =>
        localStorage.setItem("dashboard-scratchpad", ta.value));
      scBody.appendChild(ta);
    }

    let isFs = false;
    const fsBtn = document.getElementById("scratchpad-fs-btn");
    fsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isFs = !isFs;
      scSection.classList.toggle("panel-fullscreen", isFs);
      fsBtn.innerHTML = isFs ? "&#x2923;" : "&#x2922;";
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isFs) {
        isFs = false;
        scSection.classList.remove("panel-fullscreen");
        fsBtn.innerHTML = "&#x2922;";
      }
    });

    initCollapse("scratchpad-section", true);
  }

  // ── RSS Feed ───────────────────────────────────────────────
  const rssCfg = cfg.rss;

  if (!rssCfg?.enabled || !rssCfg.feeds?.length) {
    document.getElementById("rss-section").classList.add("hidden");
  } else {
    const rssSection  = document.getElementById("rss-section");
    const rssFeedEl   = document.getElementById("rss-feed");
    const rssStatusEl = document.getElementById("rss-status");

    rssSection.classList.remove("hidden");

    function parseFeed(xml, max) {
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      return [...doc.querySelectorAll("item, entry")].slice(0, max).map((item) => ({
        title: item.querySelector("title")?.textContent?.trim() || "(no title)",
        link:  item.querySelector("link")?.getAttribute("href")
            || item.querySelector("link")?.textContent?.trim() || "#",
        date: (() => { const r = item.querySelector("pubDate,published,updated")?.textContent?.trim(); const d = r ? new Date(r) : null; return d && !isNaN(d) ? d : null; })(),
      }));
    }

    async function fetchFeed(feed) {
      try {
        const res = await fetch("/rss?url=" + encodeURIComponent(feed.url));
        if (!res.ok) throw new Error(res.status);
        return { feed, items: parseFeed(await res.text(), rssCfg.maxItemsPerFeed || 5), error: null };
      } catch (e) { return { feed, items: [], error: e.message }; }
    }

    function ago(d) {
      if (!d) return "";
      const m = Math.floor((Date.now() - d) / 60000);
      if (m < 60)   return `${m}m ago`;
      if (m < 1440) return `${Math.floor(m / 60)}h ago`;
      return `${Math.floor(m / 1440)}d ago`;
    }

    function renderFeed(results) {
      rssFeedEl.innerHTML = "";
      const all = results.filter((r) => !r.error)
        .flatMap(({ feed, items }) => items.map((item) => ({ ...item, source: feed.name })))
        .sort((a, b) => (!a.date ? 1 : !b.date ? -1 : b.date - a.date));

      if (!all.length) { rssFeedEl.innerHTML = '<p class="rss-loading">No items loaded.</p>'; return; }

      all.forEach((item) => {
        const a = document.createElement("a");
        a.className = "rss-item"; a.href = item.link; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.innerHTML = `<span class="rss-title">${esc(item.title)}</span>`
          + `<span class="rss-meta"><span class="rss-source">${esc(item.source)}</span>`
          + `<span class="rss-date">${ago(item.date)}</span></span>`;
        rssFeedEl.appendChild(a);
      });
      rssStatusEl.textContent = `${all.length} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }

    async function loadFeeds() {
      rssFeedEl.innerHTML = '<p class="rss-loading">Loading…</p>';
      rssStatusEl.textContent = "";
      renderFeed(await Promise.all(rssCfg.feeds.map(fetchFeed)));
    }

    loadFeeds();
    setInterval(loadFeeds, (rssCfg.refreshMinutes || 30) * 60 * 1000);
    initCollapse("rss-section");
  }

  // ── Widget grid: free-form drag + mouse resize ────────────
  (function initWidgetGrid() {
    const grid = document.getElementById("widget-grid");
    if (!grid) return;

    // Grid constants (must match CSS grid-auto-rows and gap)
    const COLS   = 6;
    const ROW_H  = 30;       // px, matches grid-auto-rows
    const GAP    = 8;        // px, matches gap
    const UNIT_H = ROW_H + GAP;

    // Default layout — mirrors the old two-column look
    const DEFAULTS = {
      "weather-section":    { col: 1, row: 1,  cSpan: 6, rSpan: 6  },
      "rss-section":        { col: 1, row: 7,  cSpan: 4, rSpan: 14 },
      "vacation-section":   { col: 5, row: 7,  cSpan: 2, rSpan: 3  },
      "today-section":      { col: 5, row: 10, cSpan: 2, rSpan: 13 },
      "health-section":     { col: 5, row: 23, cSpan: 2, rSpan: 3  },
      "scratchpad-section": { col: 5, row: 26, cSpan: 2, rSpan: 6  },
    };

    const STATE_KEY = "dash-grid-v4";
    let state = {};
    try { state = JSON.parse(localStorage.getItem(STATE_KEY)) || {}; } catch {}

    function getS(id) {
      return state[id] || DEFAULTS[id] || { col: 1, row: 1, cSpan: 3, rSpan: 5 };
    }
    function saveState() {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }
    function applyPanel(panel) {
      const s = getS(panel.id);
      panel.style.gridColumn = `${s.col} / span ${s.cSpan}`;
      panel.style.gridRow    = `${s.row} / span ${s.rSpan}`;
    }

    // Convert pixel offset within grid → nearest column (1-based)
    function pxToCol(px) {
      const cw = (grid.clientWidth - GAP * (COLS - 1)) / COLS;
      return Math.max(1, Math.min(COLS, Math.round(px / (cw + GAP)) + 1));
    }
    // Convert pixel offset within grid → nearest row (1-based)
    function pxToRow(py) {
      return Math.max(1, Math.round(py / UNIT_H) + 1);
    }
    // Column unit width in px (excluding gaps)
    function colPx() {
      return (grid.clientWidth - GAP * (COLS - 1)) / COLS;
    }

    // Create a translucent ghost showing the candidate position
    function makeGhost(s) {
      const g = document.createElement("div");
      g.className = "drag-ghost";
      g.style.gridColumn = `${s.col} / span ${s.cSpan}`;
      g.style.gridRow    = `${s.row} / span ${s.rSpan}`;
      grid.appendChild(g);
      return g;
    }

    // ── Init all visible panels ──
    const panels = [...grid.querySelectorAll(":scope > .panel:not(.hidden)")];

    panels.forEach((panel) => {
      applyPanel(panel);

      const rhs = panel.querySelector(".panel-rhs");
      if (!rhs) return;

      // Drag handle
      const handle = document.createElement("span");
      handle.className   = "panel-drag-handle";
      handle.textContent = "⠿";
      handle.title       = "Drag to move";
      rhs.prepend(handle);

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startDrag(panel, e);
      });

      // Resize handles: right edge, bottom edge, corner
      const rE  = document.createElement("div"); rE.className  = "panel-resize-e";
      const rS  = document.createElement("div"); rS.className  = "panel-resize-s";
      const rSE = document.createElement("div"); rSE.className = "panel-resize-se";
      panel.append(rE, rS, rSE);

      rE.addEventListener("mousedown",  (e) => { e.preventDefault(); e.stopPropagation(); startResize(panel, e, "e");  });
      rS.addEventListener("mousedown",  (e) => { e.preventDefault(); e.stopPropagation(); startResize(panel, e, "s");  });
      rSE.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); startResize(panel, e, "se"); });
    });

    // ── Drag: move panel to new grid position ──
    function startDrag(panel, startE) {
      const s         = { ...getS(panel.id) };
      const gridRect  = grid.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      // Mouse offset from the panel's top-left corner (in grid-relative px)
      const offX = startE.clientX - panelRect.left;
      const offY = startE.clientY - panelRect.top;

      const ghost = makeGhost(s);
      panel.classList.add("panel-dragging");
      document.body.style.userSelect = "none";

      const onMove = (e) => {
        const gx    = e.clientX - gridRect.left - offX;
        const gy    = e.clientY - gridRect.top  - offY;
        const newC  = Math.max(1, Math.min(COLS - s.cSpan + 1, pxToCol(gx)));
        const newR  = Math.max(1, pxToRow(gy));
        ghost.style.gridColumn = `${newC} / span ${s.cSpan}`;
        ghost.style.gridRow    = `${newR} / span ${s.rSpan}`;
        ghost.dataset.col = newC;
        ghost.dataset.row = newR;
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup",   onUp);
        document.body.style.userSelect = "";
        panel.classList.remove("panel-dragging");
        const newCol = parseInt(ghost.dataset.col) || s.col;
        const newRow = parseInt(ghost.dataset.row) || s.row;
        ghost.remove();
        state[panel.id] = { ...s, col: newCol, row: newRow };
        applyPanel(panel);
        saveState();
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup",   onUp);
    }

    // ── Resize: stretch panel's column/row span ──
    function startResize(panel, startE, mode) {
      const s          = { ...getS(panel.id) };
      const cw         = colPx();
      const startX     = startE.clientX;
      const startY     = startE.clientY;
      const origCSpan  = s.cSpan;
      const origRSpan  = s.rSpan;

      const ghost = makeGhost(s);
      document.body.style.userSelect = "none";

      const onMove = (e) => {
        const dxPx = e.clientX - startX;
        const dyPx = e.clientY - startY;
        let cSpan  = origCSpan;
        let rSpan  = origRSpan;

        if (mode === "e" || mode === "se") {
          const dC = Math.round(dxPx / (cw + GAP));
          cSpan = Math.max(1, Math.min(COLS - s.col + 1, origCSpan + dC));
        }
        if (mode === "s" || mode === "se") {
          const dR = Math.round(dyPx / UNIT_H);
          rSpan = Math.max(1, origRSpan + dR);
        }

        ghost.style.gridColumn = `${s.col} / span ${cSpan}`;
        ghost.style.gridRow    = `${s.row} / span ${rSpan}`;
        ghost.dataset.cSpan = cSpan;
        ghost.dataset.rSpan = rSpan;
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup",   onUp);
        document.body.style.userSelect = "";
        const newCSpan = parseInt(ghost.dataset.cSpan) || origCSpan;
        const newRSpan = parseInt(ghost.dataset.rSpan) || origRSpan;
        ghost.remove();
        state[panel.id] = { ...s, cSpan: newCSpan, rSpan: newRSpan };
        applyPanel(panel);
        saveState();
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup",   onUp);
    }
  })();

  // ── Data export / import (all localStorage) ────────────────
  (function initDataBackup() {
    const exportBtn = document.getElementById("data-export");
    const importBtn = document.getElementById("data-import");
    const fileInput = document.getElementById("data-import-file");
    if (!exportBtn || !importBtn || !fileInput) return;

    exportBtn.addEventListener("click", () => {
      const dump = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        dump[k] = localStorage.getItem(k);
      }
      const payload = {
        _meta: { app: "openDash", version: 1, exportedAt: new Date().toISOString() },
        data: dump,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `opendash-backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    importBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let parsed;
        try { parsed = JSON.parse(reader.result); }
        catch { alert("Import failed: file is not valid JSON."); fileInput.value = ""; return; }

        // Accept both wrapped {_meta,data} and a raw key→value object.
        const data = parsed && parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          alert("Import failed: unrecognised backup format.");
          fileInput.value = "";
          return;
        }

        const keys = Object.keys(data);
        const when = parsed && parsed._meta && parsed._meta.exportedAt
          ? "\nBackup date: " + parsed._meta.exportedAt : "";
        const ok = confirm(
          "Restore " + keys.length + " item(s) from this backup?" + when +
          "\n\nThis OVERWRITES matching keys in current storage. Other keys are kept."
        );
        if (!ok) { fileInput.value = ""; return; }

        keys.forEach((k) => {
          const v = data[k];
          localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        });
        fileInput.value = "";
        alert("Restored " + keys.length + " item(s). Reloading…");
        location.reload();
      };
      reader.onerror = () => { alert("Import failed: could not read file."); fileInput.value = ""; };
      reader.readAsText(file);
    });
  })();

  // ── Cross-tab storage sync ─────────────────────────────────
  window.addEventListener("storage", (e) => {
    if (e.key === "opendash_tasks_v1" && _renderTodos)
      _renderTodos();

    if (e.key === "dashboard-scratchpad") {
      const ta = document.getElementById("scratchpad-textarea");
      if (ta && document.activeElement !== ta)
        ta.value = e.newValue || "";
    }

    if (e.key === "pomo-state" && _syncPomo)
      _syncPomo();
  });

})();
