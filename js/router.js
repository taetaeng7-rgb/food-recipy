// 해시 라우팅 — 정적 호스팅(GitHub Pages)과 궁합 (기획서 §5.5)
export function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query || '');
  return { parts, params };
}

export function onRouteChange(handler) {
  window.addEventListener('hashchange', handler);
  window.addEventListener('DOMContentLoaded', handler);
}

export function go(hash) {
  location.hash = hash;
}
