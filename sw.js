// 서비스 워커 — 오프라인 지원 (stale-while-revalidate). 기획서 §5.8
// 캐시 버전을 올리면 이전 캐시를 정리한다. 배포 시 데이터/코드가 바뀌면 버전 갱신.
const CACHE = 'food-recipy-v11';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/app.js', './js/config.js', './js/router.js', './js/data.js',
  './js/store.js', './js/scaler.js', './js/format.js', './js/nutrition.js', './js/views.js',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {})) // 일부 실패해도 설치는 진행
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached);
      return cached || network; // 캐시 있으면 즉시, 백그라운드로 갱신
    })
  );
});
