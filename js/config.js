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

export const DIFFICULTY = { easy: '쉬움', normal: '보통', hard: '어려움' };

export function categoryMeta(key) {
  return CATEGORIES.find((c) => c.key === key) || null;
}
