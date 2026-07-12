// localStorage 기반 상태 — 즐겨찾기·최근·재료체크·장보기카트·메모/별점 (백엔드 불필요)
const FAV_KEY = 'food-recipy:favs';
const RECENT_KEY = 'food-recipy:recent';
const CHECK_KEY = 'food-recipy:checks';
const CART_KEY = 'food-recipy:cart';
const CARTCHK_KEY = 'food-recipy:cartchecks';
const NOTE_KEY = 'food-recipy:notes';

function read(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function readObj(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } }
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 사파리 프라이빗 등 */ } }

// key 형식: "카테고리/id"
export function getFavs() { return read(FAV_KEY); }
export function isFav(key) { return read(FAV_KEY).includes(key); }
export function toggleFav(key) {
  const favs = read(FAV_KEY);
  const i = favs.indexOf(key);
  if (i >= 0) favs.splice(i, 1); else favs.push(key);
  write(FAV_KEY, favs);
  return favs.includes(key);
}

export function getRecent() { return read(RECENT_KEY); }
export function addRecent(key) {
  const r = read(RECENT_KEY).filter((k) => k !== key);
  r.unshift(key);
  write(RECENT_KEY, r.slice(0, 6));
}

// 장보기 재료 체크 (레시피 상세용)
export function getChecks(recipeKey) { return readObj(CHECK_KEY)[recipeKey] || []; }
export function isChecked(recipeKey, name) { return getChecks(recipeKey).includes(name); }
export function toggleCheck(recipeKey, name) {
  const all = readObj(CHECK_KEY);
  const list = all[recipeKey] || [];
  const i = list.indexOf(name);
  if (i >= 0) list.splice(i, 1); else list.push(name);
  all[recipeKey] = list;
  write(CHECK_KEY, all);
  return list.includes(name);
}
export function clearChecks(recipeKey) {
  const all = readObj(CHECK_KEY);
  delete all[recipeKey];
  write(CHECK_KEY, all);
}

// ---------- 통합 장보기 카트 ----------
// 항목: { key: "카테고리/id", servings }
export function getCart() { return read(CART_KEY); }
export function cartCount() { return read(CART_KEY).length; }
export function inCart(key) { return read(CART_KEY).some((c) => c.key === key); }
export function addToCart(key, servings) {
  const cart = read(CART_KEY);
  const ex = cart.find((c) => c.key === key);
  if (ex) ex.servings = servings; else cart.push({ key, servings });
  write(CART_KEY, cart);
  return cart;
}
export function removeFromCart(key) {
  write(CART_KEY, read(CART_KEY).filter((c) => c.key !== key));
}
export function clearCart() { write(CART_KEY, []); writeCartChecks({}); }

// 장보기 리스트에서 합산 재료 체크 (재료명 기준)
function writeCartChecks(o) { write(CARTCHK_KEY, o); }
export function getCartChecked() { return readObj(CARTCHK_KEY); }
export function toggleCartChecked(name) {
  const o = readObj(CARTCHK_KEY);
  o[name] = !o[name];
  writeCartChecks(o);
  return !!o[name];
}

// ---------- 메모 · 별점 ----------
// key 형식: "카테고리/id" → { rating: 0~5, memo: string }
export function getNote(key) { return readObj(NOTE_KEY)[key] || { rating: 0, memo: '' }; }
export function setNote(key, note) {
  const all = readObj(NOTE_KEY);
  all[key] = { rating: note.rating || 0, memo: note.memo || '' };
  if (!all[key].rating && !all[key].memo) delete all[key];
  write(NOTE_KEY, all);
}
export function getAllNotes() { return readObj(NOTE_KEY); }
