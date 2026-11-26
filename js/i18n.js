/* Honeycomb War · language
 * The game shows Simplified Chinese when the browser's language is Chinese (zh, zh-CN, zh-Hans, zh-SG, zh-TW…),
 * and English otherwise. ?lang=zh or ?lang=en in the address overrides it.
 * tr(en, zh) returns the text for the current language.
 */
(function () {
  'use strict';
  let zh = false;
  let forced = null;
  try { forced = new URLSearchParams(location.search).get('lang'); } catch (e) { /* ignore */ }
  if (forced) zh = /^zh/i.test(forced);
  else {
    const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    zh = /^zh/i.test(langs[0] || '');
  }
  const tr = (en, cn) => (zh ? cn : en);
  window.I18N = { zh, tr, lang: zh ? 'zh-CN' : 'en' };
  if (zh) {
    document.documentElement.lang = 'zh-CN';
    document.documentElement.classList.add('zh');
  }
})();

/* Text written in the HTML: data-zh="…" replaces an element's text, data-zh-content / data-zh-aria-label / data-zh-title
 * replace that attribute, and a page with blocks marked data-lang="en" and data-lang="zh" shows only the right one. */
(function () {
  'use strict';
  const I = window.I18N;
  function apply() {
    document.querySelectorAll('[data-lang]').forEach(e => { e.hidden = e.dataset.lang !== (I.zh ? 'zh' : 'en'); });
    if (!I.zh) return;
    document.querySelectorAll('[data-zh]').forEach(e => { e.textContent = e.dataset.zh; });
    ['content', 'aria-label', 'title', 'placeholder'].forEach(a => {
      document.querySelectorAll(`[data-zh-${a}]`).forEach(e => e.setAttribute(a, e.getAttribute('data-zh-' + a)));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
