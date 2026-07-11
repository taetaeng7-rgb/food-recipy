// 카테고리 정의 — 앱 전역에서 단일 소스로 사용
export const CATEGORIES = [
  { key: '한식', ja: '韓国料理', icon: '🍚', color: '#E8552D' },
  { key: '양식', ja: '洋食', icon: '🍝', color: '#E0A32E' },
  { key: '중식', ja: '中華料理', icon: '🥟', color: '#C0392B' },
  { key: '일식', ja: '和食', icon: '🍣', color: '#4A6FA5' },
];

export const DEFAULT_SERVINGS = 2;
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 4; // UI 스테퍼 상한(계산 엔진은 그 이상도 처리)

export function categoryMeta(key) {
  return CATEGORIES.find((c) => c.key === key) || null;
}

// ---------- 언어 (ko/ja) ----------
const LANG_KEY = 'food-recipy:lang';
export function getLang() {
  try { return localStorage.getItem(LANG_KEY) === 'ja' ? 'ja' : 'ko'; } catch { return 'ko'; }
}
export function setLang(l) {
  try { localStorage.setItem(LANG_KEY, l === 'ja' ? 'ja' : 'ko'); } catch { /* noop */ }
}

// UI 문자열 사전
export const UI = {
  ko: {
    brand: '🍳 오늘 뭐 만들까?', subcopy: '일본 슈퍼 재료', back: '‹ 뒤로',
    home: '홈', search: '검색', favorites: '즐겨찾기', langToggle: '日本語',
    recipesCount: (n) => `${n}개 레시피`, recent: '⭐ 최근 본 레시피',
    servings: '인분', servingsVal: (n) => `${n} 인분`,
    ingredients: (n) => `🥘 재료 (${n}인분 기준)`, stepsTitle: '👩‍🍳 조리 순서', tips: '💡 팁',
    minutes: (n) => `${n}분`,
    timer: (n) => `⏱ ${n}분 타이머`, timerCancel: '취소', timerDone: (n) => `⏰ ${n}분 완료!`,
    copy: '🛒 재료 목록 복사', copied: '복사됨 ✓', clearChecks: '체크 초기화',
    bulkNote: '※ 대량 조리 시 국·찌개 물을 5~10% 줄이고, 끓이며 간을 맞추세요.',
    celebrate: '완성! 맛있게 드세요 🎉',
    wakeOn: '🔆 화면 켜짐 유지  ON', wakeOff: '🔆 화면 켜짐 유지  OFF', wakeNA: '🔆 지원 안 됨',
    optional: ' (선택)',
    searchPh: '요리명·재료명으로 검색',
    searchHint: '요리명·재료명(한/일)으로 검색하거나 아래 필터를 눌러보세요.',
    all: '전체', noResult: '조건에 맞는 레시피가 없어요.',
    favEmpty: '아직 저장한 레시피가 없어요. ♡를 눌러 자주 만드는 요리를 저장하세요.',
    browse: '레시피 둘러보기', catEmpty: '이 카테고리에 아직 레시피가 없어요.', otherCat: '다른 카테고리 보기',
    notFound: '해당 레시피를 찾을 수 없어요.', goHome: '홈으로',
    loadFail: '레시피를 불러오지 못했어요. ', offline: '(오프라인 상태)', retry: '다시 시도',
    shoppingTitle: (t, n) => `🛒 ${t} (${n}인분) 재료`,
    diff: { easy: '쉬움', normal: '보통', hard: '어려움' },
  },
  ja: {
    brand: '🍳 今日なに作る？', subcopy: '日本のスーパー食材', back: '‹ 戻る',
    home: 'ホーム', search: '検索', favorites: 'お気に入り', langToggle: '한국어',
    recipesCount: (n) => `レシピ${n}品`, recent: '⭐ 最近見たレシピ',
    servings: '人分', servingsVal: (n) => `${n}人分`,
    ingredients: (n) => `🥘 材料（${n}人分）`, stepsTitle: '👩‍🍳 作り方', tips: '💡 コツ',
    minutes: (n) => `${n}分`,
    timer: (n) => `⏱ ${n}分タイマー`, timerCancel: 'キャンセル', timerDone: (n) => `⏰ ${n}分終了！`,
    copy: '🛒 材料リストをコピー', copied: 'コピー済み ✓', clearChecks: 'チェックをリセット',
    bulkNote: '※ 大量調理では汁物の水を5〜10%減らし、味を見ながら調整してください。',
    celebrate: '完成！召し上がれ 🎉',
    wakeOn: '🔆 画面をつけたまま  ON', wakeOff: '🔆 画面をつけたまま  OFF', wakeNA: '🔆 非対応',
    optional: '（任意）',
    searchPh: '料理名・材料名で検索',
    searchHint: '料理名・材料名（韓/日）で検索、または下のフィルターをタップ。',
    all: 'すべて', noResult: '条件に合うレシピがありません。',
    favEmpty: 'まだ保存したレシピがありません。♡でよく作る料理を保存しましょう。',
    browse: 'レシピを見る', catEmpty: 'このカテゴリーにはまだレシピがありません。', otherCat: '他のカテゴリーを見る',
    notFound: 'レシピが見つかりません。', goHome: 'ホームへ',
    loadFail: 'レシピを読み込めませんでした。', offline: '（オフライン）', retry: '再試行',
    shoppingTitle: (t, n) => `🛒 ${t}（${n}人分）材料`,
    diff: { easy: '簡単', normal: '普通', hard: '難しい' },
  },
};

// 하위 호환(구 코드 참조용)
export const DIFFICULTY = UI.ko.diff;
