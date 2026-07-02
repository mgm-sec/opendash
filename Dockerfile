# node:26-alpine — latest Node line on Alpine, 0 known CVEs; enters LTS ~Nov 2026.
# Major pinned so version bumps arrive as Dependabot PRs, not silently.
FROM node:26-alpine
# The app needs only the node binary — strip npm/yarn/corepack attack surface.
RUN rm -rf /usr/local/lib/node_modules /opt/yarn* /usr/local/bin/npm /usr/local/bin/npx \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/corepack
WORKDIR /app
COPY server.js index.html config.js settings.js app.js sw.js style.css opendash.css ./
USER node
ENV PORT=8151
EXPOSE 8151
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8151/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
