// 앱 진입점 — 라우터 ↔ 뷰 연결 (기획서 §5.5)
import { parseHash, onRouteChange } from './router.js';
import { loadCategory, getRecipe, loadAll } from './data.js';
import * as views from './views.js';

function sanitizeServings(raw, base) {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < 1) return base;
  return Math.min(20, Math.round(n));
}

async function render() {
  const app = document.getElementById('app');
  const { parts, params } = parseHash();
  try {
    if (parts[0] === 'category' && parts[1]) {
      views.renderCategory(app, parts[1], await loadCategory(parts[1]));
    } else if (parts[0] === 'recipe' && parts[1] && parts[2]) {
      const recipe = await getRecipe(parts[1], parts[2]);
      if (!recipe) { views.renderNotFound(app); return; }
      views.renderRecipe(app, recipe, sanitizeServings(params.get('n'), recipe.baseServings));
    } else if (parts[0] === 'cook' && parts[1] && parts[2]) {
      const recipe = await getRecipe(parts[1], parts[2]);
      if (!recipe) { views.renderNotFound(app); return; }
      views.renderCook(app, recipe, sanitizeServings(params.get('n'), recipe.baseServings));
    } else if (parts[0] === 'fridge') {
      views.renderFridge(app, await loadAll());
    } else if (parts[0] === 'shopping') {
      views.renderShopping(app, await loadAll());
    } else if (parts[0] === 'search') {
      views.renderSearch(app, await loadAll());
    } else if (parts[0] === 'favorites') {
      views.renderFavorites(app, await loadAll());
    } else {
      views.renderHome(app, await loadAll());
    }
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    views.renderError(app, err);
  }
}

onRouteChange(render);

// PWA: 오프라인·홈화면 앱 (https 또는 localhost에서만 등록됨)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 미지원/실패 무시 */ });
  });
}
