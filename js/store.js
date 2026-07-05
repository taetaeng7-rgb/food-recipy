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
