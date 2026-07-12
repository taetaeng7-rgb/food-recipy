// 레시피 JSON 검증 (기획서 §6.3, R01~R15). 실행: npm run validate:recipes
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scaleIngredient } from '../js/scaler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, '..', 'data', 'recipes');

const CATEGORIES = ['한식', '양식', '중식', '일식', '멕시칸'];
const UNITS = ['g', 'ml', '큰술', '작은술', '컵', '개', '모', '대', '장', '쪽', '줌', '적당량'];
const SCALE_TYPES = ['linear', 'sqrt', 'count', 'fixed', 'to-taste'];
const COUNT_UNITS = ['개', '모', '대', '장', '쪽'];

const errors = [];
const ids = new Set();
let total = 0;

for (const cat of CATEGORIES) {
  const file = join(DIR, cat + '.json');
  let recipes;
  try {
    recipes = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`[${cat}.json] R15 JSON 파싱 실패: ${e.message}`);
    continue;
  }
  if (!Array.isArray(recipes)) {
    errors.push(`[${cat}.json] 최상위가 배열이 아님`);
    continue;
  }
  recipes.forEach((r, ri) => {
    total++;
    const at = (m) => `[${cat}.json #${ri} ${(r && r.id) || '?'}] ${m}`;

    for (const f of ['id', 'title', 'category', 'baseServings', 'ingredients', 'steps']) {
      if (r[f] === undefined) errors.push(at(`R01 필수 필드 누락: ${f}`));
    }
    if (r.id && !/^[a-z0-9-]+$/.test(r.id)) errors.push(at('R02 id는 소문자 kebab-case'));
    if (r.id) {
      if (ids.has(r.id)) errors.push(at('R03 id 중복'));
      ids.add(r.id);
    }
    if (!r.title || !r.title.ko || !r.title.ja) errors.push(at('R04 title.ko/ja 필요'));
    if (r.category !== cat) errors.push(at(`R13 category(${r.category})가 파일(${cat})과 불일치`));
    if (!CATEGORIES.includes(r.category)) errors.push(at('R13 category 유효값 아님'));
    if (!(typeof r.baseServings === 'number' && r.baseServings > 0)) errors.push(at('R05 baseServings 양수 필요'));
    if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) errors.push(at('R06 ingredients 최소 1개'));
    if (!Array.isArray(r.steps) || r.steps.length === 0 || r.steps.some((s) => !s || !String(s).trim())) {
      errors.push(at('R12 steps 배열·비어있지 않음'));
    }
    // R16: 일본어 단계 번역(있으면 steps와 같은 길이, 빈 항목 없음 — 타이머·체크가 인덱스로 대응)
    if (r.stepsJa !== undefined) {
      if (!Array.isArray(r.stepsJa) || r.stepsJa.length !== (r.steps || []).length || r.stepsJa.some((s) => !s || !String(s).trim())) {
        errors.push(at('R16 stepsJa는 steps와 같은 길이의 비어있지 않은 배열'));
      }
    }
    // R17: 일본어 팁 번역(있으면 tips와 같은 길이)
    if (r.tipsJa !== undefined) {
      if (!Array.isArray(r.tipsJa) || r.tipsJa.length !== (r.tips || []).length || r.tipsJa.some((s) => !s || !String(s).trim())) {
        errors.push(at('R17 tipsJa는 tips와 같은 길이의 비어있지 않은 배열'));
      }
    }

    (r.ingredients || []).forEach((ing, ii) => {
      const iat = (m) => at(`ingredients[${ii}] ${m}`);
      if (!ing.name || !ing.name.ko || !ing.name.ja) errors.push(iat('R07 name.ko/ja 필요'));
      if (!SCALE_TYPES.includes(ing.scaleType)) errors.push(iat(`R10 scaleType 유효값 아님: ${ing.scaleType}`));
      if (!UNITS.includes(ing.unit)) errors.push(iat(`R09 unit 표준 아님: ${ing.unit}`));
      if (ing.scaleType === 'to-taste') {
        if (ing.amount !== null) errors.push(iat('R08 to-taste는 amount:null 이어야 함'));
      } else if (!(typeof ing.amount === 'number' && ing.amount >= 0)) {
        errors.push(iat('R08 amount는 숫자 ≥ 0'));
      }
      if (ing.scaleType === 'count' && !COUNT_UNITS.includes(ing.unit)) {
        errors.push(iat(`R11 count는 개수 단위(개/모/대/장/쪽)여야 함: ${ing.unit}`));
      }
      // R18: noteJa(있으면 비어있지 않은 문자열, note가 있을 때만 의미)
      if (ing.noteJa !== undefined && (!ing.noteJa || typeof ing.noteJa !== 'string')) {
        errors.push(iat('R18 noteJa는 비어있지 않은 문자열'));
      }
      // R14: 기준 인분으로 재계산 시 원본과 동일 (계산 무결성)
      if (ing.scaleType !== 'to-taste' && typeof ing.amount === 'number') {
        const back = scaleIngredient(ing, 1).value;
        if (Math.abs(back - ing.amount) > 0.001) {
          errors.push(iat(`R14 스케일 항등 위반: ${ing.amount} → ${back} (roundStep/단위 확인)`));
        }
      }
    });
  });
}

if (errors.length) {
  console.error(`❌ 레시피 검증 실패 — ${errors.length}건 (레시피 ${total}개 중)`);
  for (const e of errors) console.error('  · ' + e);
  process.exit(1);
} else {
  console.log(`✅ 레시피 검증 통과 — ${total}개 레시피, ${ids.size}개 고유 id, 오류 0`);
}
