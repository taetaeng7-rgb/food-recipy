// DOM 렌더러 — 데이터는 textContent로 안전 렌더(XSS 마진). (기획서 §4, §5.5)
import { CATEGORIES, categoryMeta, DIFFICULTY, MIN_SERVINGS, MAX_SERVINGS } from './config.js';
import { scaleRecipe } from './scaler.js';
import { go } from './router.js';
import * as store from './store.js';

const enc = encodeURIComponent;
let wakeLock = null;

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
  app.replaceChildren();
}

function key(r) { return `${r.category}/${r.id}`; }
function totalTime(r) {
  const t = r.time || {};
  if (t.prepMin != null || t.cookMin != null) return (t.prepMin || 0) + (t.cookMin || 0);
  return r.totalTimeMin || 0;
}
function stepGlyph(i) { return i < 20 ? String.fromCodePoint(0x2460 + i) : `${i + 1}.`; }

// ---------- 공통 컴포넌트 ----------
function tabBar(active) {
  const tab = (icon, label, hash, id) =>
    el('button', {
      class: 'tab' + (active === id ? ' tab-active' : ''),
      attrs: { type: 'button', 'aria-label': label },
      on: { click: () => go(hash) },
    }, [el('span', { class: 'tab-icon', text: icon }), el('span', { class: 'tab-label', text: label })]);
  return el('nav', { class: 'tabbar' }, [
    tab('🏠', '홈', '#/', 'home'),
    tab('🔍', '검색', '#/search', 'search'),
    tab('♡', '즐겨찾기', '#/favorites', 'fav'),
  ]);
}

function header(title, opts = {}) {
  const left = opts.back
    ? el('button', { class: 'icon-btn', text: '‹ 뒤로', attrs: { type: 'button', 'aria-label': '뒤로 가기' }, on: { click: () => history.back() } })
    : el('span', { class: 'brand', text: '🍳 오늘 뭐 만들까?' });
  const right = opts.right || el('button', { class: 'icon-btn', text: '🔍', attrs: { type: 'button', 'aria-label': '검색' }, on: { click: () => go('#/search') } });
  return el('header', { class: 'app-header' }, [left, el('h1', { class: 'header-title', text: title || '' }), right]);
}

function heartButton(r) {
  const k = key(r);
  const btn = el('button', { class: 'heart', attrs: { type: 'button', 'aria-label': '즐겨찾기' } });
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
      el('span', { class: 'ko', text: r.title.ko }),
      el('span', { class: 'ja', text: r.title.ja }),
    ]),
    el('div', { class: 'card-meta', text: `⏱ ${totalTime(r)}분 · ★ ${DIFFICULTY[r.difficulty] || r.difficulty || ''}` }),
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
      el('span', { class: 'cat-ko', text: c.key }),
      el('span', { class: 'cat-ja', text: c.ja }),
      el('span', { class: 'cat-count', text: `${counts[c.key]}개 레시피` }),
    ])
  ));

  const sections = [
    header('', { right: el('span', { class: 'subcopy', text: '일본 슈퍼 재료' }) }),
    el('div', { class: 'screen' }, [grid]),
  ];

  // 최근 본 레시피
  const recentKeys = store.getRecent();
  const recent = recentKeys.map((k) => allRecipes.find((r) => key(r) === k)).filter(Boolean);
  if (recent.length) {
    sections[1].append(
      el('h2', { class: 'section-title', text: '⭐ 최근 본 레시피' }),
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
      text: c.key,
    })
  ));
  const list = recipes.length
    ? el('div', { class: 'menu-list' }, recipes.map(menuCard))
    : emptyState('🍽', '이 카테고리에 아직 레시피가 없어요.', '다른 카테고리 보기', '#/');

  app.append(header(category, { back: true }), el('div', { class: 'screen' }, [tabs, list]), tabBar('home'));
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
    el('h1', { text: recipe.title.ko }),
    el('span', { class: 'ja', text: recipe.title.ja }),
    el('div', { class: 'card-meta', text: `⏱ ${totalTime(recipe)}분 · ★ ${DIFFICULTY[recipe.difficulty] || ''}` }),
  ]);

  // 인분 스테퍼 (sticky)
  const valueLabel = el('span', { class: 'stepper-val' });
  const minus = el('button', { class: 'step-btn', text: '−', attrs: { type: 'button', 'aria-label': '인분 줄이기' } });
  const plus = el('button', { class: 'step-btn', text: '+', attrs: { type: 'button', 'aria-label': '인분 늘리기' } });
  const stepper = el('div', { class: 'stepper' }, [
    el('span', { class: 'stepper-cap', text: '인분' }),
    el('div', { class: 'stepper-ctl' }, [minus, valueLabel, plus]),
  ]);

  // 재료
  const ingLabel = el('h2', { class: 'section-title' });
  const ingBox = el('ul', { class: 'ingredients' });
  const bulkNote = el('p', { class: 'bulk-note', attrs: { hidden: 'hidden' } });

  // 조리 단계
  const total = recipe.steps.length;
  const progress = el('span', { class: 'progress' });
  let done = 0;
  const stepsBox = el('ol', { class: 'steps' }, recipe.steps.map((text, i) => {
    const check = el('span', { class: 'step-check', text: '☐' });
    const li = el('li', { class: 'step', attrs: { role: 'button', tabindex: '0' } }, [
      el('span', { class: 'step-num', text: stepGlyph(i) }),
      el('span', { class: 'step-text', text: text }),
      check,
    ]);
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
  const celebrate = el('div', { class: 'celebrate', text: '완성! 맛있게 드세요 🎉', attrs: { hidden: 'hidden' } });
  progress.textContent = `0/${total}`;

  function update() {
    const scaled = scaleRecipe(recipe, servings);
    ingLabel.textContent = `🥘 재료 (${servings}인분 기준)`;
    valueLabel.textContent = `${servings} 인분`;
    minus.disabled = servings <= MIN_SERVINGS;
    plus.disabled = servings >= MAX_SERVINGS;
    ingBox.replaceChildren(...scaled.ingredients.map((ing) => {
      const row = el('li', { class: 'ing' }, [
        el('input', { class: 'ing-chk', attrs: { type: 'checkbox', 'aria-label': ing.name.ko } }),
        el('span', { class: 'ing-name' }, [
          el('span', { class: 'ko', text: ing.name.ko + (ing.optional ? ' (선택)' : '') }),
          el('span', { class: 'ja', text: ing.name.ja }),
        ]),
        el('span', { class: 'ing-amt', text: ing.display }),
      ]);
      if (ing.note) row.append(el('span', { class: 'ing-note', text: '※ ' + ing.note }));
      return row;
    }));
    bulkNote.hidden = scaled.ratio < 3;
    if (scaled.ratio >= 3) bulkNote.textContent = '※ 대량 조리 시 국·찌개 물을 5~10% 줄이고, 끓이며 간을 맞추세요.';
    history.replaceState(null, '', `#/recipe/${enc(recipe.category)}/${enc(recipe.id)}?n=${servings}`);
  }
  minus.addEventListener('click', () => { if (servings > MIN_SERVINGS) { servings--; update(); } });
  plus.addEventListener('click', () => { if (servings < MAX_SERVINGS) { servings++; update(); } });

  // 팁
  const tips = (recipe.tips && recipe.tips.length)
    ? el('div', { class: 'tips' }, [
        el('h2', { class: 'section-title', text: '💡 팁' }),
        el('ul', {}, recipe.tips.map((t) => el('li', { text: t }))),
      ])
    : null;

  // Cooking Mode: 화면 꺼짐 방지
  let cooking = null;
  if ('wakeLock' in navigator) {
    const wbtn = el('button', { class: 'wake-toggle', attrs: { type: 'button', 'aria-pressed': 'false' }, text: '🔆 화면 켜짐 유지  OFF' });
    wbtn.addEventListener('click', async () => {
      if (wakeLock) { releaseWake(); wbtn.textContent = '🔆 화면 켜짐 유지  OFF'; wbtn.setAttribute('aria-pressed', 'false'); }
      else {
        try { wakeLock = await navigator.wakeLock.request('screen'); wbtn.textContent = '🔆 화면 켜짐 유지  ON'; wbtn.setAttribute('aria-pressed', 'true'); }
        catch { wbtn.textContent = '🔆 지원 안 됨'; }
      }
    });
    cooking = el('div', { class: 'cooking-bar' }, [wbtn]);
  }

  const header2 = header(recipe.title.ko, { back: true, right: heartButton(recipe) });
  app.append(
    header2,
    el('div', { class: 'screen recipe' }, [
      hero, titleBlock,
      stepper,
      ingLabel, ingBox, bulkNote,
      el('h2', { class: 'section-title' }, [document.createTextNode('👩‍🍳 조리 순서 '), progress]),
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
  const input = el('input', { class: 'search-input', attrs: { type: 'search', placeholder: '요리명·재료명으로 검색', 'aria-label': '검색' } });
  const results = el('div', { class: 'menu-list' });
  const hint = el('div', { class: 'search-hint' }, [
    el('p', { text: '요리명·재료명(한/일)으로 검색' }),
  ]);
  function run() {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.replaceChildren(); results.append(hint); return; }
    const hits = allRecipes.filter((r) => {
      const hay = [r.title.ko, r.title.ja, ...(r.tags || []),
        ...r.ingredients.flatMap((i) => [i.name.ko, i.name.ja])].join(' ').toLowerCase();
      return hay.includes(q);
    });
    results.replaceChildren(...(hits.length ? hits.map(menuCard) : [emptyState('🔍', `‘${input.value.trim()}’에 대한 결과가 없어요.`)]));
  }
  input.addEventListener('input', run);
  results.append(hint);
  app.append(
    el('header', { class: 'app-header' }, [
      el('button', { class: 'icon-btn', text: '‹', attrs: { type: 'button', 'aria-label': '뒤로' }, on: { click: () => history.back() } }),
      input,
    ]),
    el('div', { class: 'screen' }, [results]),
    tabBar('search'),
  );
  input.focus();
}

// ---------- 화면: 즐겨찾기 ----------
export function renderFavorites(app, allRecipes) {
  clear(app);
  const favKeys = store.getFavs();
  const favs = allRecipes.filter((r) => favKeys.includes(key(r)));
  const body = favs.length
    ? el('div', { class: 'menu-list' }, favs.map(menuCard))
    : emptyState('♡', '아직 저장한 레시피가 없어요. ♡를 눌러 자주 만드는 요리를 저장하세요.', '레시피 둘러보기', '#/');
  app.append(header('즐겨찾기', { back: true }), el('div', { class: 'screen' }, [body]), tabBar('fav'));
}

// ---------- 화면: 없음 / 에러 ----------
export function renderNotFound(app) {
  clear(app);
  app.append(header('', { back: true }), el('div', { class: 'screen' }, [
    emptyState('🤔', '해당 레시피를 찾을 수 없어요.', '홈으로', '#/'),
  ]), tabBar('home'));
}

export function renderError(app, err) {
  clear(app);
  app.append(header('', {}), el('div', { class: 'screen' }, [
    emptyState('⚠️', '레시피를 불러오지 못했어요. ' + (navigator.onLine ? '' : '(오프라인 상태)'), '다시 시도', '#/'),
    el('pre', { class: 'err-detail', text: String(err && err.message || err) }),
  ]), tabBar('home'));
}
