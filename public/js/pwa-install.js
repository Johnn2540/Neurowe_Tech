(function () {
  'use strict';

  var VERSION = '3'; // bump this whenever key semantics change

  var KEYS = {
    version     : 'nwt_pwa_v',
    firstVisit  : 'nwt_pwa_fv',
    views       : 'nwt_pwa_views',
    dismissed   : 'nwt_pwa_dismissed',  // set ONLY by explicit "Not Now" / ✕ / Escape
    wasInstalled: 'nwt_pwa_installed',  // set by appinstalled; cleared when re-install detected
  };

  var VIEWS_THRESHOLD = 2;
  var TIME_THRESHOLD  = 30000;                    // 30 s from first recorded visit
  var COOLDOWN        = 30 * 24 * 60 * 60 * 1000; // 30 days

  var deferredPrompt = null;
  var shown          = false;

  // ── One-time migration ──────────────────────────────────────────────────────
  // Older code wrote `dismissed` on every install — not just on "Not Now" clicks.
  // That left users permanently blocked after uninstalling.  Clear stale state once.
  (function migrate() {
    if (localStorage.getItem(KEYS.version) !== VERSION) {
      localStorage.removeItem(KEYS.dismissed);
      localStorage.removeItem(KEYS.wasInstalled);
      localStorage.removeItem(KEYS.views);
      localStorage.removeItem(KEYS.firstVisit);
      localStorage.setItem(KEYS.version, VERSION);
    }
  })();

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function isDismissed() {
    var ts = localStorage.getItem(KEYS.dismissed);
    if (!ts) return false;
    return (Date.now() - parseInt(ts, 10)) < COOLDOWN;
  }

  function getPopup() {
    return document.getElementById('pwa-install-popup');
  }

  function showPopup() {
    if (shown || isDismissed() || !deferredPrompt) return;
    var popup = getPopup();
    if (!popup) return;
    shown = true;
    popup.removeAttribute('aria-hidden');
    popup.classList.add('pwa-popup--visible');
  }

  function hidePopup(saveDismissal) {
    var popup = getPopup();
    if (popup) {
      popup.classList.remove('pwa-popup--visible');
      popup.setAttribute('aria-hidden', 'true');
    }
    if (saveDismissal) {
      localStorage.setItem(KEYS.dismissed, Date.now().toString());
    }
    deferredPrompt = null;
    shown = false;
  }

  // ── Visit tracking ──────────────────────────────────────────────────────────

  function trackVisit() {
    if (!localStorage.getItem(KEYS.firstVisit)) {
      localStorage.setItem(KEYS.firstVisit, Date.now().toString());
    }
    var v = parseInt(localStorage.getItem(KEYS.views) || '0', 10) + 1;
    localStorage.setItem(KEYS.views, v.toString());
  }

  // ── Schedule display ────────────────────────────────────────────────────────

  function schedulePopup(immediately) {
    if (isDismissed()) return;

    if (immediately) {
      // Re-install path: no thresholds needed — show quickly
      setTimeout(showPopup, 1200);
      return;
    }

    var views      = parseInt(localStorage.getItem(KEYS.views) || '0', 10);
    var firstVisit = parseInt(localStorage.getItem(KEYS.firstVisit) || Date.now().toString(), 10);
    var elapsed    = Date.now() - firstVisit;

    if (views >= VIEWS_THRESHOLD) {
      setTimeout(showPopup, 1800);
    } else {
      setTimeout(showPopup, Math.max(0, TIME_THRESHOLD - elapsed));
    }
  }

  // ── beforeinstallprompt ─────────────────────────────────────────────────────
  // The browser only fires this when the app is genuinely installable (not installed).
  // If wasInstalled is set it means the app was previously installed and is now gone.

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;

    var reinstall = localStorage.getItem(KEYS.wasInstalled) === '1';
    if (reinstall) {
      localStorage.removeItem(KEYS.wasInstalled);
      localStorage.removeItem(KEYS.dismissed);
      localStorage.removeItem(KEYS.views);
      localStorage.removeItem(KEYS.firstVisit);
    }

    schedulePopup(reinstall);
  });

  // ── appinstalled ─────────────────────────────────────────────────────────────

  window.addEventListener('appinstalled', function () {
    hidePopup(false);                           // hide without setting dismissed
    localStorage.setItem(KEYS.wasInstalled, '1'); // remember it was installed
    localStorage.removeItem(KEYS.dismissed);    // clear any leftover dismissed state
    localStorage.removeItem(KEYS.views);
    localStorage.removeItem(KEYS.firstVisit);
  });

  // ── DOM wiring ───────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    trackVisit();

    var installBtn = document.getElementById('pwa-install-btn');
    var dismissBtn = document.getElementById('pwa-dismiss-btn');
    var closeBtn   = document.getElementById('pwa-close-btn');

    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        var prompt = deferredPrompt;
        hidePopup(false);
        prompt.prompt();
        prompt.userChoice.then(function (choice) {
          if (choice.outcome !== 'accepted') {
            // User explicitly declined the OS dialog — treat as "Not Now"
            localStorage.setItem(KEYS.dismissed, Date.now().toString());
          }
          // If accepted: appinstalled will fire and handle cleanup
        });
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () { hidePopup(true); });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () { hidePopup(true); });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && shown) hidePopup(true);
    });
  });

})();
