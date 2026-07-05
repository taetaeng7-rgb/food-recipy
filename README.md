# food-recipy 🍳

일본 슈퍼에서 쉽게 살 수 있는 재료로 만드는 요리 레시피 웹앱.
카테고리(한식·양식·중식·일식) → 메뉴 선택 → **인분 입력** → 재료·양 자동 계산 → 단계별 조리 가이드.

- 재료명 **한/일 병기** (매대에서 바로 찾기)
- 인분만 바꾸면 물 ml·간장 큰술·소금 g까지 재료 특성에 맞게 자동 재계산
- 폰으로 요리하며 보는 **모바일 우선** UI

> 📄 상세 설계는 [개발기획서.md](개발기획서.md) 참고.

## 상태
착수 전 기획 확정(v1.0). 아직 구현 코드 없음 — 기획서만 존재.

## 기술 스택 (예정)
- 바닐라 HTML + CSS + JS (ES 모듈), 빌드 없음
- 레시피 데이터: 카테고리별 JSON (`data/recipes/*.json`)
- 배포: GitHub Pages

## 레시피 추가 방법 (구현 후)
`data/recipes/<카테고리>.json` 배열 끝에 아래 템플릿을 붙여넣고 값만 수정 → commit.

```json
{
  "id": "kr-xxx",
  "title": { "ko": "요리명", "ja": "料理名" },
  "category": "한식",
  "baseServings": 2,
  "time": { "prepMin": 0, "cookMin": 0 },
  "difficulty": "easy",
  "tags": [],
  "ingredients": [
    { "name": { "ko": "재료", "ja": "材料" }, "amount": 0, "unit": "g", "scaleType": "linear" }
  ],
  "steps": ["1단계"],
  "tips": []
}
```

`scaleType`: `linear`(정비례) · `sqrt`(간·향 완만) · `count`(개수 반올림) · `fixed`(고정) · `to-taste`(기호에 따라).
자세한 규칙은 기획서 §1.4 참고.
