// ============================================================
//  OPENDASH DEFAULT CONFIGURATION
//  These are defaults only — anything you change in the ⚙
//  settings UI is stored in localStorage and merged over this.
// ============================================================

const CONFIG = {

  // --- General ---
  title: "openDash",
  greeting: "Good {time}, {name}",
  name: "there",
  showClock: true,
  showDate: true,

  // --- Background ---
  background: {
    type: "color",              // "color" | "gradient" | "image"
    color: "#060810",
    gradient: "linear-gradient(135deg, #060810 0%, #080a12 50%, #060810 100%)",
    image: "",                   // URL or path when type = "image"
  },

  // --- Search ---
  search: {
    enabled: true,
    engine: "duckduckgo",     // "duckduckgo" | "google" — can be overridden by the UI toggle
    openInNewTab: true,
    placeholder: "Search...",
  },

  // --- Weather ---
  // Uses Open-Meteo (free, no API key needed)
  weather: {
    enabled: true,
    refreshMinutes: 30,
    offsets: [0, 2, 5, 10], // hours from now shown as columns
    locations: [
      { name: "Amsterdam", lat: 52.3676, lon: 4.9041 },
      { name: "London", lat: 51.5074, lon: -0.1278 },
      { name: "New York", lat: 40.7128, lon: -74.006 },
    ],
  },

  // --- "Until …" Countdown ---
  vacation: {
    enabled: true,
    label: "Until New Year",
    date: "2027-01-01",          // YYYY-MM-DD
  },

  // --- Today (task list) ---
  today: {
    enabled: true,
  },

  // --- Pomodoro (inside the Today tile) ---
  pomodoro: {
    enabled: true,
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakAfter: 4,          // pomodoros before a long break
  },

  // --- Service Health ---
  // Uses the /ping endpoint in server.js (HEAD request per service).
  // If you run openDash in Docker, use host.docker.internal:<port>
  // instead of localhost to reach services on the host machine.
  health: {
    enabled: true,
    refreshMinutes: 5,
    services: [
      // { name: "My API",       url: "http://localhost:8081/health" },
      // { name: "Local DB UI",  url: "http://localhost:5050" },
    ],
  },

  // --- Scratchpad ---
  // Set url to an Excalidraw (or any iframe-able app) running locally.
  // Leave empty to use the built-in textarea (auto-saved to localStorage).
  scratchpad: {
    enabled: true,
    url: "",                    // e.g. "http://localhost:3001"
  },

  // --- RSS Feeds ---
  rss: {
    enabled: true,
    refreshMinutes: 30,
    maxItemsPerFeed: 5,
    feeds: [
      { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
      { name: "Schneier on Security", url: "https://www.schneier.com/feed/atom" },
      { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews" },
      { name: "Bleeping Computer", url: "https://www.bleepingcomputer.com/feed/" },
      { name: "CISA Advisories", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml" },
      { name: "US-CERT / NCAS", url: "https://www.cisa.gov/uscert/ncas/current-activity.xml" },
      { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml" },
      { name: "Threatpost", url: "https://threatpost.com/feed/" },
      { name: "AI Incident Database", url: "https://incidentdatabase.ai/rss.xml" },],
  },

};
