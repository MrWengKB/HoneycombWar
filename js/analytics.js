/*
 * Google Analytics (GA4) on the website and in the Android app: counts visits and which pages are used.
 * It never sends game data, names you enter or Google Drive files.
 * Honeycomb War is not a children's (Families) app, so analytics also run in the APK/AAB.
 */
(function () {
  var host = location.hostname;
  if (location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1') return;
  var id = 'G-LVJJ4GY9FC';
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
})();
