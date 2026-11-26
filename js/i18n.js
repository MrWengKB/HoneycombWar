/* Honeycomb War · language
 * Three languages: English (en), Simplified Chinese (zh) and Traditional Chinese (tw).
 * Which one: ?lang=en / zh / tw in the address, else the player's own choice from the En 简 繁 picker
 * (kept in this browser), else the system language: zh-TW, zh-HK, zh-MO and zh-Hant get Traditional,
 * any other Chinese gets Simplified, everything else English.
 * tr(en, zh) returns the text for the current language. The Chinese text is written in Simplified;
 * for Traditional it goes through cv(), which converts it with Taiwan wording (蜂窝战争 → 蜂窩戰爭).
 */
(function () {
  'use strict';
  const KEY = 'hw.lang';
  const norm = v => {
    v = String(v || '').toLowerCase().replace('_', '-');
    if (!v) return null;
    if (v === 'en' || v.startsWith('en-')) return 'en';
    if (v === 'tw' || /^zh-(tw|hk|mo)\b|hant/.test(v)) return 'tw';
    if (v.startsWith('zh')) return 'zh';
    return null;
  };
  let forced = null, saved = null;
  try { forced = norm(new URLSearchParams(location.search).get('lang')); } catch (e) { /* ignore */ }
  try { saved = norm(localStorage.getItem(KEY)); } catch (e) { /* ignore */ }
  const sys = () => {
    const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    const l = norm(langs[0]);
    return l === 'zh' || l === 'tw' ? l : 'en';
  };
  const lang = forced || saved || sys();
  const zh = lang !== 'en', tw = lang === 'tw';

  /* ---------- Simplified → Traditional (Taiwan) ---------- */
  // Words that Taiwan says differently, matched longest first; then character by character
  const WORDS = {
    '云端硬盘': '雲端硬碟', '网络': '網路', '无法连接': '無法連線到', '连接': '連線', '退出登录': '登出', '登录': '登入',
    '加载': '載入', '设置': '設定', '信息': '資訊', '数据': '資料', '设备': '裝置', '文件夹': '資料夾', '文件': '檔案',
    '本地存储': '本機儲存空間', '存储空间': '儲存空間', '的存储': '的儲存空間', '› 存储 ›': '› 儲存空間 ›', '存储': '儲存',
    '在安卓应用': '在 Android 應用程式', '安卓应用': 'Android 應用程式', '应用': '應用程式', '卸载': '解除安裝',
    '回收站': '垃圾桶', '菜单': '選單', '欢迎页面': '歡迎畫面', '隐私政策': '隱私權政策', '许可协议': '授權條款',
    '署名': '姓名標示', '公共领域': '公眾領域', '服务器': '伺服器', '激励广告': '獎勵廣告', '发送': '傳送',
    '重置': '重設', '点两次': '點兩下', '打开': '開啟', '访问': '存取', '创建': '建立', '占领': '佔領', '占满': '佔滿', '防御': '防禦', '通过': '透過', '保存': '儲存', '丢失': '遺失', '退出后': '登出後',
    '里': '裡', '着': '著', '“': '「', '”': '」', '‘': '『', '’': '』'
  };
  const S = '与丢两个为乐争于云仅从们会传伤体储关内减击则刚创删务动励区协单参双发变号后吗围墙声处备夹夺对层属并广应开弃强归当录总戏战拥换据敌数无旧时显机权来标样档检欢没浏游满点献环现电盖盘确种窝筑紧红级细经结络统继绩续绿缘缩网胜脑获蓝装见规览认议记许设访试该详说请谁谢负贡败账赢轮载输边达过还这进连选递邮邻钮销长问间阅随隐页项领颗颜额骤';
  const T = '與丟兩個為樂爭於雲僅從們會傳傷體儲關內減擊則剛創刪務動勵區協單參雙發變號後嗎圍牆聲處備夾奪對層屬並廣應開棄強歸當錄總戲戰擁換據敵數無舊時顯機權來標樣檔檢歡沒瀏遊滿點獻環現電蓋盤確種窩築緊紅級細經結絡統繼績續綠緣縮網勝腦獲藍裝見規覽認議記許設訪試該詳說請誰謝負貢敗帳贏輪載輸邊達過還這進連選遞郵鄰鈕銷長問間閱隨隱頁項領顆顏額驟';
  const CH = {};
  for (let i = 0; i < S.length; i++) CH[S[i]] = T[i];
  CH['占'] = '佔';
  const LENS = [...new Set(Object.keys(WORDS).map(w => w.length))].sort((a, b) => b - a);
  function toHant(s) {
    let out = '';
    for (let i = 0; i < s.length;) {
      let hit = false;
      for (const L of LENS) {
        const w = WORDS[s.substr(i, L)];
        if (w !== undefined) { out += w; i += L; hit = true; break; }
      }
      if (!hit) { const c = s[i++]; out += CH[c] || c; }
    }
    return out;
  }
  const cv = s => (tw && typeof s === 'string' ? toHant(s) : s);
  const tr = (en, cn) => (zh ? cv(cn) : en);
  // Converts every piece of text under a node (a dialog's HTML, a template, a page section)
  function cvTree(root) {
    if (!tw || !root) return root;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeValue = toHant(n.nodeValue);
    return root;
  }

  /** The player picked a language: remember it and reload in it ('auto' forgets the choice) */
  function setLang(v) {
    v = norm(v);
    try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    try { if (window.HWApp && window.HWApp.setLang) window.HWApp.setLang(v || ''); } catch (e) { /* ignore */ }
    if ((v || sys()) === lang && !forced) return;
    try {
      const u = new URL(location.href);
      u.searchParams.delete('lang');
      location.replace(u.toString());
    } catch (e) { location.reload(); }
  }
  // The Android app shows its own messages (update prompt, ads) in the same language
  try { if (window.HWApp && window.HWApp.setLang) window.HWApp.setLang(saved || forced || ''); } catch (e) { /* ignore */ }

  const code = tw ? 'zh-TW' : zh ? 'zh-CN' : 'en';
  window.I18N = { zh, tw, lang: code, choice: lang, tr, cv, cvTree, setLang };
  document.documentElement.lang = code;
  if (zh) document.documentElement.classList.add('zh');
  if (tw) document.documentElement.classList.add('tw');
})();

/* Text written in the HTML: data-zh="…" replaces an element's text, data-zh-content / data-zh-aria-label / data-zh-title
 * replace that attribute, and a page with blocks marked data-lang="en" and data-lang="zh" shows only the right one.
 * In Traditional all of it, and the how-to templates, is converted.
 * <div class="langpick"> gets the En 简 繁 buttons. */
(function () {
  'use strict';
  const I = window.I18N;
  function picker(box) {
    box.innerHTML = '';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', I.tr('Language', '语言'));
    [['en', 'En', 'English'], ['zh', '简', '简体中文'], ['tw', '繁', '繁體中文']].forEach(([v, label, name]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.lang = v === 'en' ? 'en' : v === 'zh' ? 'zh-CN' : 'zh-TW';
      b.title = name;
      b.setAttribute('aria-label', name);
      b.setAttribute('aria-pressed', String(I.choice === v));
      if (I.choice === v) b.classList.add('on');
      b.addEventListener('click', () => I.setLang(v));
      box.appendChild(b);
    });
  }
  function apply() {
    document.querySelectorAll('[data-lang]').forEach(e => { e.hidden = e.dataset.lang !== (I.zh ? 'zh' : 'en'); });
    document.querySelectorAll('.langpick').forEach(picker);
    if (!I.zh) return;
    document.querySelectorAll('[data-zh]').forEach(e => { e.textContent = I.cv(e.dataset.zh); });
    ['content', 'aria-label', 'title', 'placeholder'].forEach(a => {
      document.querySelectorAll(`[data-zh-${a}]`).forEach(e => e.setAttribute(a, I.cv(e.getAttribute('data-zh-' + a))));
    });
    if (I.tw) {
      document.querySelectorAll('[data-lang="zh"]').forEach(I.cvTree);
      document.querySelectorAll('template').forEach(t => I.cvTree(t.content));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
