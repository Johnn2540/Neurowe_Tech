(function () {
  'use strict';

  var KEYS = {
    firstVisit : 'nwt_pwa_fv',
    views      : 'nwt_pwa_views',
    dismissed  : 'nwt_pwa_dismissed',
  };

  var VIEWS_THRESHOLD  = 2;
  var TIME_THRESHOLD   = 30000; // 30 s from first recorded visit
  var COOLDOWN         = 30 * 24 * 60 * 60 * 1000; // 30 days

  var deferredPrompt = null;
  var shown          = false;

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  // ── Visit tracking ─────────────────────────────────────────────────────────

  function trackVisit() {
    if (!localStorage.getItem(KEYS.firstVisit)) {
      localStorage.setItem(KEYS.firstVisit, Date.now().toString());
    }
    var v = parseInt(localStorage.getItem(KEYS.views) || '0', 10) + 1;
    localStorage.setItem(KEYS.views, v.toString());
  }

  // ── Schedule the popup based on visit count or elapsed time ───────────────

  function schedulePopup() {
    if (isDismissed()) return;

    var views     = parseInt(localStorage.getItem(KEYS.views) || '0', 10);
    var firstVisit = parseInt(localStorage.getItem(KEYS.firstVisit) || Date.now().toString(), 10);
    var elapsed   = Date.now() - firstVisit;

    if (views >= VIEWS_THRESHOLD) {
      // Already hit page-view threshold — show after a short settle delay
      setTimeout(showPopup, 1800);
    } else {
      // Show after the remainder of the 30-second window
      var remaining = Math.max(0, TIME_THRESHOLD - elapsed);
      setTimeout(showPopup, remaining);
    }
  }

  // ── beforeinstallprompt ────────────────────────────────────────────────────

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    schedulePopup();
  });

  // ── appinstalled ──────────────────────────────────────────────────────────

  window.addEventListener('appinstalled', function () {
    hidePopup(true);
    localStorage.removeItem(KEYS.views);
    localStorage.removeItem(KEYS.firstVisit);
  });

  // ── DOM wiring ─────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    trackVisit();

    var installBtn = document.getElementById('pwa-install-btn');
    var dismissBtn = document.getElementById('pwa-dismiss-btn');
    var closeBtn   = document.getElementById('pwa-close-btn');

    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        var prompt = deferredPrompt;
        hidePopup(false); // hide immediately for good UX
        prompt.prompt();
        prompt.userChoice.then(function () {
          localStorage.setItem(KEYS.dismissed, Date.now().toString());
        });
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () { hidePopup(true); });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () { hidePopup(true); });
    }

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && shown) hidePopup(true);
    });
  });

})();
