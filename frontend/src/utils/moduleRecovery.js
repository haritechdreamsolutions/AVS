const RECOVERY_KEY = 'avs.module-recovery-at';
const COOLDOWN_MS = 5 * 60 * 1000;

export function isModuleLoadError(error) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .+ failed/i.test(String(error?.message || error || ''));
}

// Reload once on an outdated initial load. Never automatically discard user input.
export function installModuleRecovery(win) {
  let hasInput = false;
  const markInput = () => { hasInput = true; };
  const recover = event => {
    if (!isModuleLoadError(event.payload) || hasInput || win.navigator.onLine === false) return;
    try {
      const previous = Number(win.sessionStorage.getItem(RECOVERY_KEY) || 0);
      const now = Date.now();
      if (previous && now - previous < COOLDOWN_MS) return;
      win.sessionStorage.setItem(RECOVERY_KEY, String(now));
    } catch {
      // Without persistent loop protection, leave recovery to the user.
      return;
    }
    event.preventDefault();
    win.location.reload();
  };
  win.addEventListener('input', markInput, true);
  win.addEventListener('change', markInput, true);
  win.addEventListener('vite:preloadError', recover);
  return () => {
    win.removeEventListener('input', markInput, true);
    win.removeEventListener('change', markInput, true);
    win.removeEventListener('vite:preloadError', recover);
  };
}
