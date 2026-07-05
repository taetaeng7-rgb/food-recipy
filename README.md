# food-recipy 🍳

일본 슈퍼에서 쉽게 살 수 있는 재료로 만드는 요리 레시피 웹앱.
카테고리(한식·양식·중식·일식) → 메뉴 선택 → **인분 입력** → 재료·양 자동 계산 → 단계별 조리 가이드.

- 재료명 **한/일 병기** (매대에서 바로 찾기)
- 인분만 바꾸면 물 ml·간장 큰술·소금 g까지 재료 특성에 맞게 자동 재계산
- 폰으로 요리하며 보는 **모바일 우선** UI (화면 꺼짐 방지, 스텝 체크)
- 백엔드 없는 **정적 웹앱**(빌드 불필요) — 레시피는 JSON

> 📄 상세 설계는 [개발기획서.md](개발기획서.md) 참고.

## 상태
**MVP 구현 완료 (v1.0)** · 시드 레시피 14건(한식 5·양식 3·중식 3·일식 3).

## 로컬 실행
빌드가 없어 정적 서버만 있으면 됩니다. (ES 모듈 + fetch 때문에 `file://` 직접 열기는 불가)

```bash
# 저장소 루트에서
python3 -m http.server 8765
# 브라우저에서 http://localhost:8765 접속
```

## 테스트 / 검증 (Node 18+)
```bash
npm test               # 계산 엔진·표기 단위 테스트 (node --test)
npm run validate:recipes  # 레시피 JSON 검증 (R01~R15)
npm run test:all       # 검증 + 테스트
```

## 배포 (GitHub Pages)
Settings → Pages → Source: **Deploy from a branch** → `main` / `/(root)`.
배포 URL: `https://taetaeng7-rgb.github.io/food-recipy/`
(모든 경로는 상대경로 + 해시 라우팅이라 `/food-recipy/` 하위에서도 그대로 동작)

## 폴더 구조
```
index.html            # 앱 셸
css/style.css         # 모바일 우선 스타일(라이트/다크)
js/
  app.js              # 진입점(라우터↔뷰)
  config.js router.js data.js store.js
  scaler.js format.js # 인분 계산 엔진 + 표기(순수 함수)
  views.js            # 화면 렌더러
data/recipes/*.json   # 카테고리별 레시피
scripts/validate-recipes.js
test/*.test.js
```

## 레시피 추가 방법
`data/recipes/<카테고리>.json` 배열 끝에 아래 템플릿을 붙여넣고 값만 수정 → commit.
추가 후 `npm run validate:recipes`로 검증하세요.

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

`scaleType`: `linear`(정비례) · `sqrt`(간·향 완만) · `count`(개수 반올림, 개/모/대/장/쪽) · `fixed`(고정) · `to-taste`(기호에 따라, `amount: null`).
자세한 규칙은 기획서 §1.4 참고.
