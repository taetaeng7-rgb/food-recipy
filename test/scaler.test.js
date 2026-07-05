// 인분 계산 엔진 테스트 (기획서 §6.2). 실행: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleAmount, scaleIngredient } from '../js/scaler.js';

// display 헬퍼: 재료를 scaleType/양/단위로 만들어 배율 적용 후 표시 문자열 반환
function display(amount, unit, scaleType, ratio, roundStep = 1) {
  return scaleIngredient({ name: { ko: 'x', ja: 'x' }, amount, unit, scaleType, roundStep }, ratio).display;
}

test('§6.2 스케일링 표시 케이스', () => {
  // #1~#4 linear
  assert.equal(display(200, 'ml', 'linear', 2), '400 ml');   // 2→4
  assert.equal(display(200, 'ml', 'linear', 0.5), '100 ml'); // 2→1
  assert.equal(display(200, 'ml', 'linear', 1.5), '300 ml'); // 2→3
  assert.equal(display(30, 'ml', 'linear', 1.5), '45 ml');   // 홀수 결과

  // #5~#7 count (반올림)
  assert.equal(display(2, '개', 'count', 1.5), '3 개'); // 2→3 딱 맞음
  assert.equal(display(1, '개', 'count', 1.5), '2 개'); // round(1.5)=2
  assert.equal(display(3, '개', 'count', 0.75), '2 개'); // round(2.25)=2

  // #8~#11 sqrt / fixed
  assert.equal(display(4, 'g', 'sqrt', 2), '6 g');   // 4*√2≈5.66 → <10 반올림 1단위 → 6
  assert.equal(display(8, 'g', 'sqrt', 0.5), '6 g'); // 8*√0.5≈5.66 → 6
  assert.equal(display(2, 'g', 'sqrt', 4), '4 g');   // 2*2=4
  assert.equal(display(1, '장', 'fixed', 4), '1 장'); // 고정

  // #12~#13 극단
  assert.equal(display(200, 'ml', 'linear', 0.25), '50 ml');    // 0.5인분
  assert.equal(display(100, 'ml', 'linear', 100), '10000 ml');  // 초대형

  // #14~#17 분수 표기 (큰술은 0.5 단위로 스냅 → ¼는 ½로 정리)
  assert.equal(display(1, '큰술', 'linear', 0.5), '½ 큰술');
  assert.equal(display(1, '큰술', 'linear', 0.25), '½ 큰술'); // 0.25→0.5 스냅
  assert.equal(display(1, '큰술', 'linear', 1.5), '1½ 큰술');
  assert.equal(display(3, '큰술', 'linear', 0.75), '2½ 큰술'); // 2.25→2.5 스냅
});

test('작은술은 ¼ 단위 분수를 보존한다', () => {
  assert.equal(display(1, '작은술', 'linear', 0.25), '¼ 작은술');
  assert.equal(display(1, '작은술', 'linear', 0.75), '¾ 작은술');
});

test('to-taste는 계산하지 않고 "기호에 따라"', () => {
  assert.equal(display(null, '적당량', 'to-taste', 4), '기호에 따라');
});

test('count는 최소 roundStep을 하한으로 보장', () => {
  assert.equal(scaleAmount(1, 'count', 0.1, 1), 1); // 0으로 사라지지 않음
  assert.equal(scaleAmount(1, 'count', 0.4, 0.5), 0.5);
});

test('스케일 항등: ratio=1이면 count/linear 원본 유지', () => {
  assert.equal(scaleAmount(2, 'count', 1, 1), 2);
  assert.equal(scaleAmount(0.5, 'count', 1, 0.5), 0.5);
  assert.equal(scaleAmount(150, 'linear', 1), 150);
});

test('알 수 없는 scaleType은 linear로 폴백', () => {
  assert.equal(scaleAmount(10, 'weird', 2), 20);
});
