// 표기·반올림 테스트 (기획서 §5.3). 실행: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundByUnit, toFraction, formatAmount } from '../js/format.js';

test('roundByUnit — g/ml 값 크기별 스텝', () => {
  assert.equal(roundByUnit(400, 'ml'), 400);   // ≥100 → 10단위
  assert.equal(roundByUnit(143, 'g'), 140);    // ≥100 → 10단위 → 140
  assert.equal(roundByUnit(72, 'g'), 70);      // 10~100 → 5단위 → 70
  assert.equal(roundByUnit(45, 'ml'), 45);     // 10~100 → 5단위
  assert.equal(roundByUnit(5.657, 'g'), 6);    // <10 → 1단위
  assert.equal(roundByUnit(150, 'g'), 150);
});

test('roundByUnit — 스푼/개수 단위', () => {
  assert.equal(roundByUnit(0.25, '큰술'), 0.5);  // 0.5 스텝
  assert.equal(roundByUnit(0.25, '작은술'), 0.25); // 0.25 스텝
  assert.equal(roundByUnit(1, '장'), 1);
  assert.equal(roundByUnit(7, '적당량'), 7); // 미지정 단위는 그대로
});

test('toFraction — 분수 글리프', () => {
  assert.equal(toFraction(0.25), '¼');
  assert.equal(toFraction(0.5), '½');
  assert.equal(toFraction(0.75), '¾');
  assert.equal(toFraction(1.5), '1½');
  assert.equal(toFraction(2.25), '2¼');
  assert.equal(toFraction(3), '3');
  assert.equal(toFraction(0.99), '1'); // 1에 근접 → 정수
});

test('formatAmount — 값/단위 조합', () => {
  assert.equal(formatAmount(400, 'ml'), '400 ml');
  assert.equal(formatAmount(1.5, '큰술'), '1½ 큰술');
  assert.equal(formatAmount(null, '적당량'), '기호에 따라');
  assert.equal(formatAmount(0, 'g'), '기호에 따라');
});
