# Frontend updates and existing browser tabs

The server revalidates HTML (`Cache-Control: no-cache`), caches hashed JS/CSS as immutable, and returns missing assets as non-cacheable 404 responses. The Vite build preserves existing output assets. The browser attempts one automatic reload per five minutes for an initial dynamic-import failure, provided it is online, storage is available, and no input/change event has occurred. Otherwise the error screen offers manual reload and warns about unsaved entries.

## Release procedure

1. Build a complete release in a staging directory, never in the currently served directory.
2. Copy the previously served `frontend/dist/assets` into the staged release's `frontend/dist/assets` before building. Preserve existing hashed files; do not use a deployment command that deletes them. `emptyOutDir: false` preserves assets already present, but cannot recover files missing from the staging directory.
3. Run `npm --prefix frontend run build` with the correct API configuration. Confirm the new HTML, all referenced chunks, and retained prior-release chunks return HTTP 200 with JavaScript/CSS content types as appropriate.
4. Switch the complete release atomically using the hosting platform's release switch or an atomic release-directory symlink. Restart the backend to load its cache/recovery-serving changes. Avoid independently overwriting HTML and assets on the running release.
5. If a CDN/proxy overrides origin headers, configure HTML revalidation there too and purge cached HTML/negative asset responses. Keep hashed assets immutable.
6. Verify an already-open old tab and a fresh tab. Old assets must remain available as long as old tabs are supported. Clean up retained assets only under an explicit retention policy; bounded reload is a fallback, not a substitute for asset retention.

## Verification

Run `node --test backend/test/module-recovery.test.js`. On Linux with bundled Playwright Chromium installed, set `AVS_TEST_BROWSER=chromium`. Tests exercise actual HTTP headers, retained chunks, missing chunk responses, real-browser recovery, reload-loop protection, offline/blocked-storage conditions and preservation of edited fields. No business records are written.

This change requires deployment to affect the live site. It does not repair an old missing chunk until the corresponding retained asset is restored or the browser reloads a valid current release.
