// 레시피 데이터 로더 — 카테고리별 JSON fetch + 메모리 캐시 (기획서 §1.2 / §5.2)
import { CATEGORIES } from './config.js';

const cache = new Map();

export async function loadCategory(category) {
  if (cache.has(category)) return cache.get(category);
  const url = './data/recipes/' + encodeURIComponent(category) + '.json';
  const res = await fetch(url);
  if (!res.ok) throw new Error('데이터 로드 실패: ' + category);
  const recipes = await res.json();
  cache.set(category, recipes);
  return recipes;
}

export async function getRecipe(category, id) {
  const recipes = await loadCategory(category);
  return recipes.find((r) => r.id === id) || null;
}

export async function loadAll() {
  const lists = await Promise.all(
    CATEGORIES.map((c) => loadCategory(c.key).catch(() => []))
  );
  return lists.flat();
}
