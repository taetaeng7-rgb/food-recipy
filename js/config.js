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
    tabShopping: '장보기',
    fridgeEntry: '🧊 냉장고 재료로 찾기',
    fridgeTitle: '냉장고 재료로 찾기',
    fridgeHint: '가진 재료를 선택하면 만들 수 있는 요리를 보여드려요.',
    fridgePick: (n) => `선택한 재료 ${n}개`,
    fridgeMakeable: '✅ 지금 만들 수 있어요',
    fridgeHave: (a, b) => `주재료 ${a}/${b} 보유`,
    fridgeMissing: '부족: ',
    fridgeNone: '재료를 선택하면 추천이 나와요.',
    fridgeClear: '선택 초기화',
    cartAdd: '🛒 장보기에 담기', cartAdded: '담김 ✓', cartUpdate: '🛒 담김(수량 갱신) ✓',
    cartTitle: '장보기 리스트',
    cartEmpty: '장보기 리스트가 비어 있어요. 레시피에서 “장보기에 담기”를 눌러 추가하세요.',
    cartRecipes: '담은 레시피', cartClear: '전체 비우기', cartCopy: '🛒 리스트 복사', cartItems: '재료 (합산)',
    cookStart: '▶ 요리 시작 (쿡 모드)', cookExit: '✕ 종료',
    cookStep: (a, b) => `${a} / ${b} 단계`, cookPrev: '‹ 이전', cookNext: '다음 ›', cookDone: '완성! 🎉',
    nutriTitle: '영양정보 (1인분·추정)',
    nutriKcal: 'kcal', nutriCarb: '탄수', nutriProtein: '단백', nutriFat: '지방',
    nutriApprox: (p) => `※ 추정치 · 재료 ${p}% 반영`,
    noteTitle: '📝 내 메모·별점', notePlaceholder: '이 레시피 메모 (예: 다음엔 덜 맵게, 물 줄이기)',
    noteSave: '저장', noteSaved: '저장됨 ✓',
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
    tabShopping: '買い物',
    fridgeEntry: '🧊 冷蔵庫の食材で探す',
    fridgeTitle: '冷蔵庫の食材で探す',
    fridgeHint: '持っている食材を選ぶと、作れる料理を表示します。',
    fridgePick: (n) => `選択した食材 ${n}個`,
    fridgeMakeable: '✅ 今すぐ作れます',
    fridgeHave: (a, b) => `主な材料 ${a}/${b} あり`,
    fridgeMissing: '不足: ',
    fridgeNone: '食材を選ぶとおすすめが出ます。',
    fridgeClear: '選択をリセット',
    cartAdd: '🛒 買い物リストに追加', cartAdded: '追加済み ✓', cartUpdate: '🛒 追加(数量更新) ✓',
    cartTitle: '買い物リスト',
    cartEmpty: '買い物リストが空です。レシピの「買い物リストに追加」を押して追加してください。',
    cartRecipes: '追加したレシピ', cartClear: 'すべて削除', cartCopy: '🛒 リストをコピー', cartItems: '材料（合算）',
    cookStart: '▶ 料理スタート（クックモード）', cookExit: '✕ 終了',
    cookStep: (a, b) => `${a} / ${b} ステップ`, cookPrev: '‹ 前へ', cookNext: '次へ ›', cookDone: '完成！🎉',
    nutriTitle: '栄養情報（1人分・目安）',
    nutriKcal: 'kcal', nutriCarb: '糖質', nutriProtein: 'たんぱく', nutriFat: '脂質',
    nutriApprox: (p) => `※ 目安 · 食材の${p}%を反映`,
    noteTitle: '📝 マイメモ・評価', notePlaceholder: 'このレシピのメモ（例: 次回は控えめに、水を減らす）',
    noteSave: '保存', noteSaved: '保存済み ✓',
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
