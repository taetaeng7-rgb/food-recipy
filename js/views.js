// DOM 렌더러 — 데이터는 textContent로 안전 렌더(XSS 마진). (기획서 §4, §5.5)
// 언어(ko/ja): getLang() 기준으로 UI 문자열·재료명·단계(stepsJa 폴백)를 전환.
import { CATEGORIES, categoryMeta, MIN_SERVINGS, MAX_SERVINGS, UI, getLang, setLang } from './config.js';
import { formatAmountJa } from './format.js';
import { scaleRecipe } from './scaler.js';
import { go } from './router.js';
import * as store from './store.js';

const enc = encodeURIComponent;
let wakeLock = null;
const activeTimers = new Set();

function t() { return UI[getLang()]; }
function isJa() { return getLang() === 'ja'; }

function clearTimers() { for (const id of activeTimers) clearInterval(id); activeTimers.clear(); }
function fmtClock(s) { const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; }
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + 0.5);
    o.onended = () => ctx.close();
  } catch { /* noop */ }
}
function buzz() { try { if (navigator.vibrate) navigator.vibrate([300, 120, 300]); } catch { /* noop */ } }

// ---------- 소형 DOM 헬퍼 ----------
function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.html != null) node.innerHTML = opts.html; // 내부 상수 문자열에만 사용
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (opts.style) node.setAttribute('style', opts.style);
  if (opts.on) for (const [k, v] of Object.entries(opts.on)) node.addEventListener(k, v);
  for (const c of [].concat(children)) if (c != null && c !== false) node.append(c);
  return node;
}

function releaseWake() {
  if (wakeLock) { try { wakeLock.release(); } catch { /* noop */ } wakeLock = null; }
}

function clear(app) {
  releaseWake();
  clearTimers();
  app.replaceChildren();
}

function key(r) { return `${r.category}/${r.id}`; }
function totalTime(r) {
  const time = r.time || {};
  if (time.prepMin != null || time.cookMin != null) return (time.prepMin || 0) + (time.cookMin || 0);
  return r.totalTimeMin || 0;
}
function stepGlyph(i) { return i < 20 ? String.fromCodePoint(0x2460 + i) : `${i + 1}.`; }

// 다이어트(저탄수) 레시피 표시 — tags에 '다이어트'가 있으면 🥗 배지
function isDiet(r) { return (r.tags || []).includes('다이어트'); }

// 언어별 텍스트 선택 헬퍼
function titleOf(r) { return (isJa() ? r.title.ja : r.title.ko) + (isDiet(r) ? ' 🥗' : ''); }
function subTitleOf(r) { return isJa() ? r.title.ko : r.title.ja; }
function dietLabel() { return isJa() ? '🥗 低糖質' : '🥗 저탄수'; }
function nameOf(ing) { return isJa() ? ing.name.ja : ing.name.ko; }
function subNameOf(ing) { return isJa() ? ing.name.ko : ing.name.ja; }
function stepsOf(r) {
  if (isJa() && Array.isArray(r.stepsJa) && r.stepsJa.length) return r.stepsJa;
  return r.steps;
}
function tipsOf(r) {
  if (isJa() && Array.isArray(r.tipsJa) && r.tipsJa.length) return r.tipsJa;
  return r.tips;
}
function noteOf(ing) { return (isJa() && ing.noteJa) ? ing.noteJa : ing.note; }
function catLabel(c) { return isJa() ? c.ja : c.key; }
function metaLine(r) {
  const base = `⏱ ${t().minutes(totalTime(r))} · ★ ${t().diff[r.difficulty] || r.difficulty || ''}`;
  return isDiet(r) ? `${base} · ${dietLabel()}` : base;
}

// ---------- 공통 컴포넌트 ----------
function tabBar(active) {
  const tab = (icon, label, handler, id) =>
    el('button', {
      class: 'tab' + (active === id ? ' tab-active' : ''),
      attrs: { type: 'button', 'aria-label': label },
      on: { click: handler },
    }, [el('span', { class: 'tab-icon', text: icon }), el('span', { class: 'tab-label', text: label })]);
  return el('nav', { class: 'tabbar' }, [
    tab('🏠', t().home, () => go('#/'), 'home'),
    tab('🔍', t().search, () => go('#/search'), 'search'),
    tab('♡', t().favorites, () => go('#/favorites'), 'fav'),
    tab('🌐', t().langToggle, () => {
      setLang(isJa() ? 'ko' : 'ja');
      window.dispatchEvent(new Event('hashchange')); // 현재 화면 재렌더
    }, 'lang'),
  ]);
}

function header(title, opts = {}) {
  const left = opts.back
    ? el('button', { class: 'icon-btn', text: t().back, attrs: { type: 'button', 'aria-label': t().back }, on: { click: () => history.back() } })
    : el('span', { class: 'brand', text: t().brand });
  const right = opts.right || el('button', { class: 'icon-btn', text: '🔍', attrs: { type: 'button', 'aria-label': t().search }, on: { click: () => go('#/search') } });
  return el('header', { class: 'app-header' }, [left, el('h1', { class: 'header-title', text: title || '' }), right]);
}

function heartButton(r) {
  const k = key(r);
  const btn = el('button', { class: 'heart', attrs: { type: 'button', 'aria-label': t().favorites } });
  const paint = () => { btn.textContent = store.isFav(k) ? '♥' : '♡'; btn.classList.toggle('on', store.isFav(k)); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); store.toggleFav(k); paint(); });
  paint();
  return btn;
}

function menuCard(r) {
  const meta = categoryMeta(r.category);
  const thumb = el('div', { class: 'thumb', text: meta ? meta.icon : '🍽',
    style: `background:${meta ? meta.color : '#ccc'}22;color:${meta ? meta.color : '#888'}` });
  const info = el('div', { class: 'card-info' }, [
    el('div', { class: 'card-title' }, [
      el('span', { class: 'ko', text: titleOf(r) }),
      el('span', { class: 'ja', text: subTitleOf(r) }),
    ]),
    el('div', { class: 'card-meta', text: metaLine(r) }),
  ]);
  return el('button', {
    class: 'menu-card', attrs: { type: 'button' },
    on: { click: () => go(`#/recipe/${enc(r.category)}/${enc(r.id)}`) },
  }, [thumb, info, heartButton(r)]);
}

function emptyState(icon, msg, ctaLabel, ctaHash) {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'empty-icon', text: icon }),
    el('p', { class: 'empty-msg', text: msg }),
    ctaLabel ? el('button', { class: 'btn', text: ctaLabel, attrs: { type: 'button' }, on: { click: () => go(ctaHash) } }) : null,
  ]);
}

// 조리 단계 텍스트에서 분(minutes) 추출 (예: "20~25분"/"20〜25分" → 25, 마지막 값)
function stepMinutes(text) {
  let m, last = null;
  const re = /(\d+)\s*[분分]/g;
  while ((m = re.exec(text))) last = parseInt(m[1], 10);
  return last;
}

// 조리 타이머 버튼 (탭 시작/취소, 완료 시 알람+진동)
function stepTimerButton(minutes) {
  const label = t().timer(minutes);
  const btn = el('button', { class: 'timer-btn', attrs: { type: 'button' }, text: label });
  let id = null, remaining = 0;
  const stop = () => { if (id) { clearInterval(id); activeTimers.delete(id); id = null; } };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (id) { stop(); btn.classList.remove('running'); btn.textContent = label; return; }
    remaining = minutes * 60;
    btn.classList.remove('done'); btn.classList.add('running');
    btn.textContent = `⏱ ${fmtClock(remaining)} · ${t().timerCancel}`;
    id = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        stop(); btn.classList.remove('running'); btn.classList.add('done');
        btn.textContent = t().timerDone(minutes); beep(); buzz(); return;
      }
      btn.textContent = `⏱ ${fmtClock(remaining)} · ${t().timerCancel}`;
    }, 1000);
    activeTimers.add(id);
  });
  return btn;
}

function displayAmount(ing) {
  return isJa() ? formatAmountJa(ing.value, ing.unit) : ing.display;
}

// 장보기: 현재 인분 재료 목록을 클립보드로 복사
function copyShopping(recipe, servings, btn) {
  const scaled = scaleRecipe(recipe, servings);
  const lines = [t().shoppingTitle(titleOf(recipe), servings)];
  for (const ing of scaled.ingredients) {
    const amtText = displayAmount(ing);
    const amt = (amtText === '기호에 따라' || amtText === 'お好みで') ? '' : ` — ${amtText}`;
    lines.push(`□ ${nameOf(ing)}(${subNameOf(ing)})${amt}`);
  }
  const text = lines.join('\n');
  const ok = () => { btn.textContent = t().copied; setTimeout(() => { btn.textContent = t().copy; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok).catch(() => fallbackCopy(text, ok));
  } else fallbackCopy(text, ok);
}
function fallbackCopy(text, ok) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    if (document.body) { document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    ok();
  } catch { /* noop */ }
}

// ---------- 화면: 홈 ----------
export function renderHome(app, allRecipes) {
  clear(app);
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.key, allRecipes.filter((r) => r.category === c.key).length]));

  const grid = el('div', { class: 'cat-grid' }, CATEGORIES.map((c) =>
    el('button', {
      class: 'cat-card', attrs: { type: 'button' },
      style: `--cat:${c.color}`,
      on: { click: () => go(`#/category/${enc(c.key)}`) },
    }, [
      el('span', { class: 'cat-icon', text: c.icon }),
      el('span', { class: 'cat-ko', text: catLabel(c) }),
      el('span', { class: 'cat-ja', text: isJa() ? c.key : c.ja }),
      el('span', { class: 'cat-count', text: t().recipesCount(counts[c.key]) }),
    ])
  ));

  const sections = [
    header('', { right: el('span', { class: 'subcopy', text: t().subcopy }) }),
    el('div', { class: 'screen' }, [grid]),
  ];

  const recentKeys = store.getRecent();
  const recent = recentKeys.map((k) => allRecipes.find((r) => key(r) === k)).filter(Boolean);
  if (recent.length) {
    sections[1].append(
      el('h2', { class: 'section-title', text: t().recent }),
      el('div', { class: 'menu-list' }, recent.map(menuCard)),
    );
  }

  app.append(...sections, tabBar('home'));
}

// ---------- 화면: 카테고리 메뉴 리스트 ----------
export function renderCategory(app, category, recipes) {
  clear(app);
  const tabs = el('div', { class: 'cat-tabs' }, CATEGORIES.map((c) =>
    el('button', {
      class: 'cat-tab' + (c.key === category ? ' active' : ''),
      attrs: { type: 'button' }, style: `--cat:${c.color}`,
      on: { click: () => go(`#/category/${enc(c.key)}`) },
      text: catLabel(c),
    })
  ));
  const list = recipes.length
    ? el('div', { class: 'menu-list' }, recipes.map(menuCard))
    : emptyState('🍽', t().catEmpty, t().otherCat, '#/');

  const meta = categoryMeta(category);
  app.append(header(meta ? catLabel(meta) : category, { back: true }), el('div', { class: 'screen' }, [tabs, list]), tabBar('home'));
}

// ---------- 화면: 레시피 상세 ----------
export function renderRecipe(app, recipe, initialServings) {
  clear(app);
  store.addRecent(key(recipe));
  const meta = categoryMeta(recipe.category);
  let servings = Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(initialServings) || recipe.baseServings));

  // 히어로
  const hero = el('div', { class: 'hero', style: `background:${meta ? meta.color : '#888'}` }, [
    el('span', { class: 'hero-icon', text: meta ? meta.icon : '🍽' }),
  ]);
  const titleBlock = el('div', { class: 'recipe-title' }, [
    el('h1', { text: titleOf(recipe) }),
    el('span', { class: 'ja', text: subTitleOf(recipe) }),
    el('div', { class: 'card-meta', text: metaLine(recipe) }),
  ]);

  // 인분 스테퍼 (sticky)
  const valueLabel = el('span', { class: 'stepper-val' });
  const minus = el('button', { class: 'step-btn', text: '−', attrs: { type: 'button', 'aria-label': '-' } });
  const plus = el('button', { class: 'step-btn', text: '+', attrs: { type: 'button', 'aria-label': '+' } });
  const stepper = el('div', { class: 'stepper' }, [
    el('span', { class: 'stepper-cap', text: t().servings }),
    el('div', { class: 'stepper-ctl' }, [minus, valueLabel, plus]),
  ]);

  // 재료
  const ingLabel = el('h2', { class: 'section-title' });
  const ingBox = el('ul', { class: 'ingredients' });
  const bulkNote = el('p', { class: 'bulk-note', attrs: { hidden: 'hidden' } });

  // 장보기 액션 (재료 복사 · 체크 초기화)
  const shopBtn = el('button', { class: 'ghost-btn', text: t().copy, attrs: { type: 'button' } });
  shopBtn.addEventListener('click', () => copyShopping(recipe, servings, shopBtn));
  const clearBtn = el('button', { class: 'ghost-btn', text: t().clearChecks, attrs: { type: 'button' } });
  clearBtn.addEventListener('click', () => { store.clearChecks(key(recipe)); update(); });
  const ingActions = el('div', { class: 'ing-actions' }, [shopBtn, clearBtn]);

  // 조리 단계
  const steps = stepsOf(recipe);
  const total = steps.length;
  const progress = el('span', { class: 'progress' });
  let done = 0;
  const stepsBox = el('ol', { class: 'steps' }, steps.map((text, i) => {
    const check = el('span', { class: 'step-check', text: '☐' });
    const li = el('li', { class: 'step', attrs: { role: 'button', tabindex: '0' } }, [
      el('span', { class: 'step-num', text: stepGlyph(i) }),
      el('span', { class: 'step-text', text: text }),
      check,
    ]);
    const mins = stepMinutes(text);
    if (mins) li.append(stepTimerButton(mins));
    const toggle = () => {
      const now = li.classList.toggle('done');
      check.textContent = now ? '☑' : '☐';
      done += now ? 1 : -1;
      progress.textContent = `${done}/${total}`;
      celebrate.hidden = done !== total;
    };
    li.addEventListener('click', toggle);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    return li;
  }));
  const celebrate = el('div', { class: 'celebrate', text: t().celebrate, attrs: { hidden: 'hidden' } });
  progress.textContent = `0/${total}`;

  function update() {
    const scaled = scaleRecipe(recipe, servings);
    ingLabel.textContent = t().ingredients(servings);
    valueLabel.textContent = t().servingsVal(servings);
    minus.disabled = servings <= MIN_SERVINGS;
    plus.disabled = servings >= MAX_SERVINGS;
    ingBox.replaceChildren(...scaled.ingredients.map((ing) => {
      const checked = store.isChecked(key(recipe), ing.name.ko);
      const chk = el('input', { class: 'ing-chk', attrs: { type: 'checkbox', 'aria-label': nameOf(ing) } });
      chk.checked = checked;
      const row = el('li', { class: 'ing' + (checked ? ' checked' : '') }, [
        chk,
        el('span', { class: 'ing-name' }, [
          el('span', { class: 'ko', text: nameOf(ing) + (ing.optional ? t().optional : '') }),
          el('span', { class: 'ja', text: subNameOf(ing) }),
        ]),
        el('span', { class: 'ing-amt', text: displayAmount(ing) }),
      ]);
      chk.addEventListener('change', () => {
        const on = store.toggleCheck(key(recipe), ing.name.ko);
        row.classList.toggle('checked', on);
      });
      const note = noteOf(ing);
      if (note) row.append(el('span', { class: 'ing-note', text: '※ ' + note }));
      return row;
    }));
    bulkNote.hidden = scaled.ratio < 3;
    if (scaled.ratio >= 3) bulkNote.textContent = t().bulkNote;
    history.replaceState(null, '', `#/recipe/${enc(recipe.category)}/${enc(recipe.id)}?n=${servings}`);
  }
  minus.addEventListener('click', () => { if (servings > MIN_SERVINGS) { servings--; update(); } });
  plus.addEventListener('click', () => { if (servings < MAX_SERVINGS) { servings++; update(); } });

  // 팁
  const tipList = tipsOf(recipe);
  const tips = (tipList && tipList.length)
    ? el('div', { class: 'tips' }, [
        el('h2', { class: 'section-title', text: t().tips }),
        el('ul', {}, tipList.map((tip) => el('li', { text: tip }))),
      ])
    : null;

  // Cooking Mode: 화면 꺼짐 방지
  let cooking = null;
  if ('wakeLock' in navigator) {
    const wbtn = el('button', { class: 'wake-toggle', attrs: { type: 'button', 'aria-pressed': 'false' }, text: t().wakeOff });
    wbtn.addEventListener('click', async () => {
      if (wakeLock) { releaseWake(); wbtn.textContent = t().wakeOff; wbtn.setAttribute('aria-pressed', 'false'); }
      else {
        try { wakeLock = await navigator.wakeLock.request('screen'); wbtn.textContent = t().wakeOn; wbtn.setAttribute('aria-pressed', 'true'); }
        catch { wbtn.textContent = t().wakeNA; }
      }
    });
    cooking = el('div', { class: 'cooking-bar' }, [wbtn]);
  }

  const header2 = header(titleOf(recipe), { back: true, right: heartButton(recipe) });
  app.append(
    header2,
    el('div', { class: 'screen recipe' }, [
      hero, titleBlock,
      stepper,
      ingLabel, ingActions, ingBox, bulkNote,
      el('h2', { class: 'section-title' }, [document.createTextNode(t().stepsTitle + ' '), progress]),
      stepsBox, celebrate,
      tips, cooking,
    ]),
    tabBar('home'),
  );
  update();
}

// ---------- 화면: 검색 ----------
export function renderSearch(app, allRecipes) {
  clear(app);
  let cat = null, tag = null;
  const input = el('input', { class: 'search-input', attrs: { type: 'search', placeholder: t().searchPh, 'aria-label': t().search } });
  const results = el('div', { class: 'menu-list' });
  const hint = el('div', { class: 'search-hint' }, [el('p', { text: t().searchHint })]);
  const catRow = el('div', { class: 'chips' });
  const tagRow = el('div', { class: 'chips' });
  const tags = [...new Set(allRecipes.flatMap((r) => r.tags || []))].slice(0, 12);
  const chip = (label, on, click) => el('button', { class: 'chip' + (on ? ' on' : ''), text: label, attrs: { type: 'button' }, on: { click } });

  function run() {
    catRow.replaceChildren(
      chip(t().all, !cat, () => { cat = null; run(); }),
      ...CATEGORIES.map((c) => chip(catLabel(c), cat === c.key, () => { cat = cat === c.key ? null : c.key; run(); })),
    );
    tagRow.replaceChildren(...tags.map((tg) => chip('#' + tg, tag === tg, () => { tag = tag === tg ? null : tg; run(); })));
    const q = input.value.trim().toLowerCase();
    let hits = allRecipes;
    if (cat) hits = hits.filter((r) => r.category === cat);
    if (tag) hits = hits.filter((r) => (r.tags || []).includes(tag));
    if (q) hits = hits.filter((r) => {
      const hay = [r.title.ko, r.title.ja, ...(r.tags || []), ...r.ingredients.flatMap((i) => [i.name.ko, i.name.ja])].join(' ').toLowerCase();
      return hay.includes(q);
    });
    if (!q && !cat && !tag) { results.replaceChildren(hint); return; }
    results.replaceChildren(...(hits.length ? hits.map(menuCard) : [emptyState('🔍', t().noResult)]));
  }
  input.addEventListener('input', run);
  app.append(
    el('header', { class: 'app-header' }, [
      el('button', { class: 'icon-btn', text: '‹', attrs: { type: 'button', 'aria-label': t().back }, on: { click: () => history.back() } }),
      input,
    ]),
    el('div', { class: 'screen' }, [catRow, tagRow, results]),
    tabBar('search'),
  );
  run();
  input.focus();
}

// ---------- 화면: 즐겨찾기 ----------
export function renderFavorites(app, allRecipes) {
  clear(app);
  const favKeys = store.getFavs();
  const favs = allRecipes.filter((r) => favKeys.includes(key(r)));
  const body = favs.length
    ? el('div', { class: 'menu-list' }, favs.map(menuCard))
    : emptyState('♡', t().favEmpty, t().browse, '#/');
  app.append(header(t().favorites, { back: true }), el('div', { class: 'screen' }, [body]), tabBar('fav'));
}

// ---------- 화면: 없음 / 에러 ----------
export function renderNotFound(app) {
  clear(app);
  app.append(header('', { back: true }), el('div', { class: 'screen' }, [
    emptyState('🤔', t().notFound, t().goHome, '#/'),
  ]), tabBar('home'));
}

export function renderError(app, err) {
  clear(app);
  app.append(header('', {}), el('div', { class: 'screen' }, [
    emptyState('⚠️', t().loadFail + (navigator.onLine ? '' : t().offline), t().retry, '#/'),
    el('pre', { class: 'err-detail', text: String(err && err.message || err) }),
  ]), tabBar('home'));
}
