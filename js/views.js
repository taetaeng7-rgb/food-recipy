// DOM 렌더러 — 데이터는 textContent로 안전 렌더(XSS 마진). (기획서 §4, §5.5)
// 언어(ko/ja): getLang() 기준으로 UI 문자열·재료명·단계(stepsJa 폴백)를 전환.
import { CATEGORIES, categoryMeta, MIN_SERVINGS, MAX_SERVINGS, UI, getLang, setLang } from './config.js';
import { roundByUnit, formatAmount, formatAmountJa } from './format.js';
import { scaleRecipe } from './scaler.js';
import { estimateNutrition } from './nutrition.js';
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

// 요리 종류별 썸네일 아이콘 — 태그·제목(한/일)으로 판별. 없으면 카테고리 아이콘 폴백.
// 명시적으로 r.icon 이 있으면 그것을 우선 사용.
const ICON_RULES = [
  [/샐러드|サラダ|コールスロー/, '🥗'],
  [/떡볶이|トッポギ/, '🌶️'],
  [/찌개|전골|국밥|육개장|삼계탕|미역국|콩나물국|계란탕|순두부|어니언|スープ|味噌汁|미소시루|국물/, '🍲'],
  [/가지|なす|茄子/, '🍆'],
  [/볶음밥|チャーハン|덮밥|丼|김밥|キンパ|비빔밥|ビビンバ|오므라이스|オムライス|솥밥|炊き込み|ガーリックライス|오야코동|규동/, '🍚'],
  [/파스타|스파게티|スパゲ|パスタ|나폴리탄|ナポリタン|미트소스|리조또|リゾット|알리오|올리오|アーリオ|ペペロンチーノ/, '🍝'],
  [/빠에야|パエリア|필라프/, '🥘'],
  [/고추잡채|青椒|チンジャオ/, '🫑'],
  [/국수|우동|소바|라멘|야키소바|焼きそば|ラーメン|うどん|そば|麺|春雨|잡채|チャプチェ|짜장|ジャージャー|콩국수/, '🍜'],
  [/가라아게|唐揚げ|치킨|チキン|닭|鶏/, '🍗'],
  [/피망|파프리카|ピーマン/, '🫑'],
  [/새우|エビ|えび|감바스|ガンバス|튀김|탕수육|酢豚|칠리|チリ/, '🍤'],
  [/토스트|トースト/, '🍞'],
  [/양배추|キャベツ|나물|무침|야채|野菜|숙주|もやし|청경채|チンゲン/, '🥬'],
  [/계란|卵|たまご|茶碗蒸し|오믈렛/, '🍳'],
  [/두부|豆腐|마파|麻婆/, '🥘'],
  [/스테이크|ステーキ|함박|ハンバーグ|불고기|プルコギ|제육|생강구이|生姜焼き|니쿠자가|肉じゃが|카쿠니|角煮|고기|牛|豚/, '🍖'],
  [/오코노미야키|お好み焼き|부침|전/, '🥘'],
];
function iconFor(r) {
  if (r.icon) return r.icon;
  const s = [...(r.tags || []), r.title.ko, r.title.ja].join(' ');
  for (const [re, emoji] of ICON_RULES) if (re.test(s)) return emoji;
  const m = categoryMeta(r.category);
  return m ? m.icon : '🍽';
}

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
  const n = store.cartCount();
  return el('nav', { class: 'tabbar' }, [
    tab('🏠', t().home, () => go('#/'), 'home'),
    tab('🔍', t().search, () => go('#/search'), 'search'),
    tab('🛒', t().tabShopping + (n ? ` (${n})` : ''), () => go('#/shopping'), 'shopping'),
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
  const thumb = el('div', { class: 'thumb', text: iconFor(r),
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
  sections[1].append(el('button', {
    class: 'fridge-entry', attrs: { type: 'button' }, text: t().fridgeEntry,
    on: { click: () => go('#/fridge') },
  }));

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
    el('span', { class: 'hero-icon', text: iconFor(recipe) }),
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

  // 영양정보(추정) — 1인분 값은 인분과 무관하게 일정하므로 기준 인분으로 한 번만 계산.
  const nutriBox = el('div', { class: 'nutrition' });
  {
    const nut = estimateNutrition(scaleRecipe(recipe, recipe.baseServings));
    if (nut) {
      nutriBox.replaceChildren(
        el('h2', { class: 'section-title', text: t().nutriTitle }),
        el('div', { class: 'nutri-row' }, [
          el('div', { class: 'nutri-cell kcal' }, [el('b', { text: String(nut.perServing.kcal) }), el('span', { text: ' ' + t().nutriKcal })]),
          el('div', { class: 'nutri-cell' }, [el('span', { text: t().nutriCarb }), el('b', { text: nut.perServing.carb + 'g' })]),
          el('div', { class: 'nutri-cell' }, [el('span', { text: t().nutriProtein }), el('b', { text: nut.perServing.protein + 'g' })]),
          el('div', { class: 'nutri-cell' }, [el('span', { text: t().nutriFat }), el('b', { text: nut.perServing.fat + 'g' })]),
        ]),
        el('p', { class: 'nutri-note', text: t().nutriApprox(Math.round(nut.coverage * 100)) }),
      );
    } else { nutriBox.hidden = true; }
  }

  // 쿡모드 시작 · 장보기 담기
  const cookBtn = el('button', {
    class: 'primary-btn', text: t().cookStart, attrs: { type: 'button' },
    on: { click: () => go(`#/cook/${enc(recipe.category)}/${enc(recipe.id)}?n=${servings}`) },
  });
  const cartBtn = el('button', { class: 'ghost-btn', text: store.inCart(key(recipe)) ? t().cartAdded : t().cartAdd, attrs: { type: 'button' } });
  cartBtn.addEventListener('click', () => {
    const was = store.inCart(key(recipe));
    store.addToCart(key(recipe), servings);
    cartBtn.textContent = was ? t().cartUpdate : t().cartAdded;
    setTimeout(() => { cartBtn.textContent = t().cartAdd; }, 1500);
  });
  const actions = el('div', { class: 'recipe-actions' }, [cookBtn, cartBtn]);

  const notesBlock = buildNotes(recipe);

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
      hero, titleBlock, nutriBox,
      actions,
      stepper,
      ingLabel, ingActions, ingBox, bulkNote,
      el('h2', { class: 'section-title' }, [document.createTextNode(t().stepsTitle + ' '), progress]),
      stepsBox, celebrate,
      tips, notesBlock, cooking,
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

// ---------- 냉장고 재료로 찾기: 선택 가능한 주재료 ----------
const FRIDGE_GROUPS = [
  { label: { ko: '채소', ja: '野菜' }, items: [
    ['양배추', 'キャベツ', /양배추|キャベツ/], ['양파', '玉ねぎ', /양파|玉ねぎ/], ['대파', '長ねぎ', /대파|長ねぎ/],
    ['당근', 'にんじん', /당근|にんじん/], ['감자', 'じゃがいも', /감자|じゃがいも/], ['가지', 'なす', /가지|なす|茄子/],
    ['오이', 'きゅうり', /오이|きゅうり/], ['토마토', 'トマト', /토마토|トマト/], ['피망·파프리카', 'ピーマン', /피망|파프리카|ピーマン|パプリカ/],
    ['애호박', 'ズッキーニ', /애호박|ズッキーニ/], ['시금치', 'ほうれん草', /시금치|ほうれん草/], ['콩나물', '大豆もやし', /콩나물/],
    ['숙주', 'もやし', /숙주/], ['부추', 'ニラ', /부추|ニラ/], ['청경채', 'チンゲン菜', /청경채|チンゲン/],
    ['버섯', 'きのこ', /버섯|きのこ|표고|しいたけ|しめじ|えのき|まいたけ|팽이|만가닥/], ['배추', '白菜', /배추|白菜/], ['양상추', 'レタス', /양상추|レタス|베이비리프/],
  ] },
  { label: { ko: '육류·해물', ja: '肉・魚介' }, items: [
    ['소고기', '牛肉', /소고기|牛/], ['돼지고기', '豚肉', /돼지|豚/], ['다진 고기', 'ひき肉', /다진 고기|다진 소|다진 돼지|합|ひき肉/],
    ['닭고기', '鶏肉', /닭|鶏/], ['베이컨', 'ベーコン', /베이컨|ベーコン/], ['스팸', 'ランチョンミート', /스팸|런천|ランチョン/],
    ['소시지', 'ウインナー', /소시지|비엔나|ウインナー/], ['새우', 'えび', /새우|えび|エビ/], ['오징어', 'いか', /오징어|いか/],
    ['바지락', 'あさり', /바지락|あさり/], ['게맛살', 'カニカマ', /게맛살|カニカマ/], ['참치캔', 'ツナ', /참치캔|ツナ/],
  ] },
  { label: { ko: '기타', ja: 'その他' }, items: [
    ['계란', '卵', /계란|卵|달걀/], ['두부', '豆腐', /두부|豆腐/], ['낫토', '納豆', /낫토|納豆/], ['김치', 'キムチ', /김치|キムチ/],
    ['밥', 'ご飯', /밥|ご飯|米/], ['면류', '麺', /면|스파게티|소면|우동|중화면|야키소바|파스타|麺|春雨|당면/], ['떡', '餅', /떡볶이떡|떡|餅/],
    ['치즈', 'チーズ', /치즈|チーズ/], ['우유', '牛乳', /우유|牛乳/], ['두유', '豆乳', /두유|豆乳/],
  ] },
];
function recipeFridgeItems(r) {
  const hay = r.ingredients.map((i) => i.name.ko + ' ' + i.name.ja).join(' ');
  const out = [];
  for (const g of FRIDGE_GROUPS) for (const [ko, ja, re] of g.items) if (re.test(hay)) out.push({ ko, ja });
  return out;
}

// 메모·별점 블록
function buildNotes(r) {
  const k = key(r);
  const note = store.getNote(k);
  let rating = note.rating || 0;
  const stars = el('div', { class: 'stars' });
  const memo = el('textarea', { class: 'note-memo', attrs: { placeholder: t().notePlaceholder, rows: '2' } });
  memo.value = note.memo || '';
  const saved = el('span', { class: 'note-saved', text: '' });
  const save = () => { store.setNote(k, { rating, memo: memo.value }); saved.textContent = t().noteSaved; setTimeout(() => { saved.textContent = ''; }, 1500); };
  const paint = () => {
    stars.replaceChildren(...[1, 2, 3, 4, 5].map((num) => el('button', {
      class: 'star' + (num <= rating ? ' on' : ''), text: num <= rating ? '★' : '☆',
      attrs: { type: 'button', 'aria-label': num + '점' },
      on: { click: () => { rating = rating === num ? 0 : num; paint(); save(); } },
    })));
  };
  memo.addEventListener('change', save);
  paint();
  const saveBtn = el('button', { class: 'ghost-btn', text: t().noteSave, attrs: { type: 'button' }, on: { click: save } });
  return el('div', { class: 'notes' }, [
    el('h2', { class: 'section-title', text: t().noteTitle }),
    stars, memo, el('div', { class: 'note-actions' }, [saveBtn, saved]),
  ]);
}

// ---------- 화면: 냉장고 재료로 찾기 ----------
export function renderFridge(app, allRecipes) {
  clear(app);
  const selected = new Set();
  const chipsWrap = el('div', { class: 'fridge-chips' });
  const resultWrap = el('div', { class: 'menu-list' });
  const countLine = el('p', { class: 'fridge-count' });
  const recIndex = allRecipes.map((r) => ({ r, items: recipeFridgeItems(r) }));

  const chip = (ko, ja) => el('button', {
    class: 'chip' + (selected.has(ko) ? ' on' : ''), text: isJa() ? ja : ko, attrs: { type: 'button' },
    on: { click: () => { if (selected.has(ko)) selected.delete(ko); else selected.add(ko); run(); } },
  });
  function renderChips() {
    chipsWrap.replaceChildren(...FRIDGE_GROUPS.map((g) => el('div', { class: 'fridge-group' }, [
      el('div', { class: 'fridge-group-label', text: isJa() ? g.label.ja : g.label.ko }),
      el('div', { class: 'chips wrap' }, g.items.map(([ko, ja]) => chip(ko, ja))),
    ])));
  }
  function run() {
    renderChips();
    countLine.textContent = t().fridgePick(selected.size);
    if (selected.size === 0) { resultWrap.replaceChildren(el('p', { class: 'search-hint', text: t().fridgeNone })); return; }
    const scored = recIndex
      .map(({ r, items }) => ({ r, items, matched: items.filter((it) => selected.has(it.ko)), missing: items.filter((it) => !selected.has(it.ko)) }))
      .filter((x) => x.matched.length >= 1)
      .sort((a, b) => (b.matched.length - a.matched.length) || (a.missing.length - b.missing.length) || (totalTime(a.r) - totalTime(b.r)));
    if (!scored.length) { resultWrap.replaceChildren(emptyState('🧊', t().noResult)); return; }
    resultWrap.replaceChildren(...scored.map((x) => {
      const makeable = x.missing.length === 0;
      const cap = el('div', { class: 'fridge-cap' + (makeable ? ' makeable' : '') }, [
        el('span', {
          text: makeable
            ? t().fridgeMakeable
            : t().fridgeHave(x.matched.length, x.items.length) + ' · ' + t().fridgeMissing + x.missing.map((m) => (isJa() ? m.ja : m.ko)).join(', '),
        }),
      ]);
      return el('div', { class: 'fridge-result' }, [menuCard(x.r), cap]);
    }));
  }
  const clearBtn = el('button', { class: 'ghost-btn', text: t().fridgeClear, attrs: { type: 'button' }, on: { click: () => { selected.clear(); run(); } } });
  app.append(
    header(t().fridgeTitle, { back: true }),
    el('div', { class: 'screen' }, [el('p', { class: 'fridge-hint', text: t().fridgeHint }), chipsWrap, countLine, clearBtn, resultWrap]),
    tabBar('home'),
  );
  run();
}

// ---------- 화면: 통합 장보기 리스트 ----------
export function renderShopping(app, allRecipes) {
  clear(app);
  const byKey = new Map(allRecipes.map((r) => [`${r.category}/${r.id}`, r]));
  const entries = store.getCart().map((c) => ({ recipe: byKey.get(c.key), servings: c.servings, key: c.key })).filter((e) => e.recipe);
  const screen = el('div', { class: 'screen' });
  if (!entries.length) {
    screen.append(emptyState('🛒', t().cartEmpty, t().browse, '#/'));
    app.append(header(t().cartTitle, { back: true }), screen, tabBar('shopping'));
    return;
  }
  const recipeChips = el('div', { class: 'chips wrap' }, entries.map((e) => el('button', {
    class: 'chip on', attrs: { type: 'button' }, text: `${titleOf(e.recipe)} (${e.servings}) ✕`,
    on: { click: () => { store.removeFromCart(e.key); renderShopping(app, allRecipes); } },
  })));
  const merged = new Map();
  for (const e of entries) {
    for (const ing of scaleRecipe(e.recipe, e.servings).ingredients) {
      const mk = ing.name.ko + '|' + ing.unit;
      if (!merged.has(mk)) merged.set(mk, { ko: ing.name.ko, ja: ing.name.ja, unit: ing.unit, value: 0, toTaste: false });
      const m = merged.get(mk);
      if (ing.scaleType === 'to-taste' || ing.value == null) m.toTaste = true; else m.value += ing.value;
    }
  }
  const items = [...merged.values()].sort((a, b) => a.ko.localeCompare(b.ko, 'ko'));
  const checked = store.getCartChecked();
  const dispOf = (m) => m.value > 0
    ? (isJa() ? formatAmountJa(roundByUnit(m.value, m.unit), m.unit) : formatAmount(roundByUnit(m.value, m.unit), m.unit))
    : (isJa() ? 'お好みで' : '기호에 따라');
  const list = el('ul', { class: 'ingredients' }, items.map((m) => {
    const chk = el('input', { class: 'ing-chk', attrs: { type: 'checkbox', 'aria-label': m.ko } });
    chk.checked = !!checked[m.ko];
    const row = el('li', { class: 'ing' + (chk.checked ? ' checked' : '') }, [
      chk,
      el('span', { class: 'ing-name' }, [el('span', { class: 'ko', text: isJa() ? m.ja : m.ko }), el('span', { class: 'ja', text: isJa() ? m.ko : m.ja })]),
      el('span', { class: 'ing-amt', text: dispOf(m) }),
    ]);
    chk.addEventListener('change', () => row.classList.toggle('checked', store.toggleCartChecked(m.ko)));
    return row;
  }));
  const copyBtn = el('button', { class: 'ghost-btn', text: t().cartCopy, attrs: { type: 'button' } });
  copyBtn.addEventListener('click', () => {
    const lines = [t().cartTitle, ...items.map((m) => `□ ${isJa() ? m.ja : m.ko}(${isJa() ? m.ko : m.ja})${m.value > 0 ? ' — ' + dispOf(m) : ''}`)];
    const text = lines.join('\n');
    const ok = () => { copyBtn.textContent = t().copied; setTimeout(() => { copyBtn.textContent = t().cartCopy; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok).catch(() => fallbackCopy(text, ok));
    else fallbackCopy(text, ok);
  });
  const clearBtn = el('button', { class: 'ghost-btn', text: t().cartClear, attrs: { type: 'button' }, on: { click: () => { store.clearCart(); renderShopping(app, allRecipes); } } });
  screen.append(
    el('div', { class: 'fridge-group-label', text: t().cartRecipes }), recipeChips,
    el('h2', { class: 'section-title', text: t().cartItems }), list,
    el('div', { class: 'ing-actions' }, [copyBtn, clearBtn]),
  );
  app.append(header(t().cartTitle, { back: true }), screen, tabBar('shopping'));
}

// ---------- 화면: 쿡 모드 (풀스크린 단계) ----------
export function renderCook(app, recipe, servings) {
  clear(app);
  if ('wakeLock' in navigator) { navigator.wakeLock.request('screen').then((l) => { wakeLock = l; }).catch(() => {}); }
  const steps = stepsOf(recipe);
  const total = steps.length;
  let idx = 0;
  const stepNum = el('div', { class: 'cook-step-num' });
  const stepText = el('p', { class: 'cook-step-text' });
  const timerSlot = el('div', { class: 'cook-timer' });
  const prog = el('div', { class: 'cook-progress' });
  const prevB = el('button', { class: 'cook-nav', text: t().cookPrev, attrs: { type: 'button' } });
  const nextB = el('button', { class: 'cook-nav primary', text: t().cookNext, attrs: { type: 'button' } });
  function paint() {
    clearTimers();
    if (idx >= total) {
      stepNum.textContent = ''; stepText.textContent = t().cookDone; timerSlot.replaceChildren();
      prog.textContent = `${total} / ${total}`; prevB.disabled = false; nextB.textContent = t().goHome;
      return;
    }
    stepNum.textContent = t().cookStep(idx + 1, total);
    stepText.textContent = steps[idx];
    prog.textContent = `${idx + 1} / ${total}`;
    const mins = stepMinutes(steps[idx]);
    timerSlot.replaceChildren(mins ? stepTimerButton(mins) : document.createTextNode(''));
    prevB.disabled = idx === 0;
    nextB.textContent = idx === total - 1 ? t().cookDone : t().cookNext;
  }
  prevB.addEventListener('click', () => { if (idx > 0) { idx--; paint(); } });
  nextB.addEventListener('click', () => {
    if (idx >= total) { go(`#/recipe/${enc(recipe.category)}/${enc(recipe.id)}?n=${servings}`); return; }
    idx += 1; paint();
  });
  const exit = el('button', { class: 'icon-btn', text: t().cookExit, attrs: { type: 'button' }, on: { click: () => history.back() } });
  app.append(el('div', { class: 'cook' }, [
    el('div', { class: 'cook-head' }, [el('span', { class: 'cook-title', text: titleOf(recipe) }), exit]),
    prog, stepNum, stepText, timerSlot,
    el('div', { class: 'cook-controls' }, [prevB, nextB]),
  ]));
  paint();
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
