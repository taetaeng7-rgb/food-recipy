// 인분 계산 엔진 — 순수 함수, 부수효과 없음 (기획서 §1.4 / §5.3)
import { roundByUnit, formatAmount } from './format.js';

// ratio = 목표인분 / 기준인분
export function scaleAmount(amount, scaleType, ratio, roundStep = 1) {
  switch (scaleType) {
    case 'linear':   return amount * ratio;
    case 'sqrt':     return amount * Math.sqrt(ratio); // 간·향은 완만하게
    case 'fixed':    return amount;
    case 'count':    return Math.max(roundStep, Math.round((amount * ratio) / roundStep) * roundStep);
    case 'to-taste': return null;
    default:         return amount * ratio; // 안전 폴백 = linear
  }
}

export function scaleIngredient(ing, ratio) {
  if (ing.scaleType === 'to-taste' || ing.amount == null) {
    return { ...ing, value: null, display: '기호에 따라' };
  }
  const raw = scaleAmount(ing.amount, ing.scaleType, ratio, ing.roundStep ?? 1);
  // count는 이미 반올림된 정수/반단위, 나머지는 표시 단위로 스냅
  const value = ing.scaleType === 'count' ? raw : roundByUnit(raw, ing.unit);
  return { ...ing, value, display: formatAmount(value, ing.unit) };
}

export function scaleRecipe(recipe, targetServings) {
  const ratio = targetServings / recipe.baseServings;
  return {
    ...recipe,
    targetServings,
    ratio,
    ingredients: recipe.ingredients.map((ing) => scaleIngredient(ing, ratio)),
  };
}
