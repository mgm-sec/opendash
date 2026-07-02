// Service Worker — background pomodoro notifications
// Stays alive in the browser even when all tabs are closed.

let _notifTimer = null;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("message", (e) => {
  if (e.data?.type === "POMO_SCHEDULE") {
    if (_notifTimer) { clearTimeout(_notifTimer); _notifTimer = null; }

    const delay = e.data.endAt - Date.now();
    if (delay <= 0) return;

    // waitUntil keeps the SW alive until the notification fires
    e.waitUntil(
      new Promise((resolve) => {
        _notifTimer = setTimeout(() => {
          _notifTimer = null;
          self.registration
            .showNotification("Pomodoro", {
              body: e.data.body || "Timer done!",
              tag:  "pomo",
              renotify: true,
            })
            .then(resolve)
            .catch(resolve);
        }, delay);
      })
    );
  } else if (e.data?.type === "POMO_CANCEL") {
    if (_notifTimer) { clearTimeout(_notifTimer); _notifTimer = null; }
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) if ("focus" in c) return c.focus();
      return self.clients.openWindow("/");
    })
  );
});
