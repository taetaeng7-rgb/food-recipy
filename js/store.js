// localStorage 기반 즐겨찾기 / 최근 본 메뉴 (기획서 P1, 백엔드 불필요)
const FAV_KEY = 'food-recipy:favs';
const RECENT_KEY = 'food-recipy:recent';

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 사파리 프라이빗 등 */ }
}

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

// 장보기 체크 상태: 레시피별로 체크한 재료 이름(한글) 집합을 저장 (인분 바뀌어도 유지)
const CHECK_KEY = 'food-recipy:checks';
function readChecks() { try { return JSON.parse(localStorage.getItem(CHECK_KEY)) || {}; } catch { return {}; } }
export function getChecks(recipeKey) { return readChecks()[recipeKey] || []; }
export function isChecked(recipeKey, name) { return getChecks(recipeKey).includes(name); }
export function toggleCheck(recipeKey, name) {
  const all = readChecks();
  const list = all[recipeKey] || [];
  const i = list.indexOf(name);
  if (i >= 0) list.splice(i, 1); else list.push(name);
  all[recipeKey] = list;
  write(CHECK_KEY, all);
  return list.includes(name);
}
export function clearChecks(recipeKey) {
  const all = readChecks();
  delete all[recipeKey];
  write(CHECK_KEY, all);
}
