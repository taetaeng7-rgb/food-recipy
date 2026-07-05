// 단위별 반올림 + 분수 표기 (순수 함수, 브라우저·Node 공용)
// 기획서 §1.4 / §4.4 / §6.2 의 표시 규칙 구현.

// g·ml은 값 크기에 따라 반올림 스텝을 달리한다(작은 양은 정밀, 큰 양은 거칠게).
//   < 10 → 1 단위 / 10~100 → 5 단위 / ≥ 100 → 10 단위
export function roundByUnit(amount, unit) {
  if (unit === 'g' || unit === 'ml') {
    const step = amount < 10 ? 1 : amount < 100 ? 5 : 10;
    return Math.round(amount / step) * step;
  }
  const STEP = {
    '큰술': 0.5, '컵': 0.5, '작은술': 0.25,
    '개': 1, '모': 0.5, '대': 0.5, '쪽': 1, '장': 1, '줌': 0.5,
  };
  const step = STEP[unit];
  if (!step) return amount; // 적당량 등은 그대로
  return +(Math.round(amount / step) * step).toFixed(2);
}

// 소수 → 요리에서 익숙한 분수 표기. 정수부는 앞에 붙인다(1½, 2¼).
const FRACTIONS = [
  [0, ''], [0.125, '⅛'], [0.25, '¼'], [0.33, '⅓'],
  [0.5, '½'], [0.67, '⅔'], [0.75, '¾'], [1, ''],
];

export function toFraction(value) {
  let whole = Math.floor(value);
  const frac = value - whole;
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) {
    if (Math.abs(frac - f[0]) < Math.abs(frac - best[0])) best = f;
  }
  if (best[0] === 1) whole += 1; // 1에 근접하면 정수로 올림
  const glyph = best[0] === 1 ? '' : best[1];
  if (!glyph) return String(whole);
  return whole === 0 ? glyph : `${whole}${glyph}`;
}

// 표시 문자열. to-taste/적당량/0 은 "기호에 따라".
export function formatAmount(value, unit) {
  if (value == null || unit === '적당량' || value === 0) return '기호에 따라';
  const num = Number.isInteger(value) ? String(value) : toFraction(value);
  return `${num} ${unit}`;
}
