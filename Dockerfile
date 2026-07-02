# Distroless Node LTS: only the Node runtime — no shell, no package manager. Non-root (uid 65532).
FROM gcr.io/distroless/nodejs24-debian12:nonroot
WORKDIR /app
COPY server.js index.html config.js settings.js app.js sw.js style.css opendash.css ./
ENV PORT=8151
EXPOSE 8151
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:8151/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["server.js"]
