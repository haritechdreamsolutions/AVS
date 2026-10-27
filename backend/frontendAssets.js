import express from 'express';
import path from 'node:path';

export function frontendAssets(directory) {
  const router = express.Router();
  router.use(express.static(directory, {
    index: false,
    setHeaders(res, file) {
      res.setHeader('Cache-Control', /[\\/]assets[\\/].+-[\w-]+\.(?:js|css)$/.test(file)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache');
    }
  }));
  // Never cache missing chunks or serve the HTML shell as JavaScript.
  router.use('/assets', (_req, res) => res.status(404).set('Cache-Control', 'no-store').end());
  router.get('*', (req, res, next) => {
    if (path.extname(req.path) || !req.accepts('html')) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(directory, 'index.html'), error => { if (error) next(error); });
  });
  return router;
}
