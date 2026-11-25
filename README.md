# 미래직업탐구 활동지 웹서비스

브라우저에서 05차시 모둠 활동지와 06차시 개인 활동지를 작성하고, AI 작성 팁으로 내용을 점검한 뒤 PDF 및 JSON 인풋데이터로 저장할 수 있는 정적 웹서비스입니다.

## 구성

- `index.html`: 활동지 선택 및 작성 진행률 확인 화면
- `05차시_모둠활동지_PC작성용.html`: 05차시 모둠 활동지 (16가지 미래 역량 카드 클릭 선택 지원)
- `06차시_개인활동지_직업탐구_PC작성용.html`: 06차시 개인 활동지 (05차시 모둠 데이터 연동 지원)
- `worksheet.css` / `worksheet-common.js`: 공통 스타일(반응형·인쇄)·자동 저장·JSON 저장/불러오기
- `pdf-export.js`: 출력용 텍스트 변환 및 PDF 저장
- `tutor.js` / `tutor-config.js`: AI 작성 팁 UI 및 엔드포인트 설정
- `worker/src/index.js` / `wrangler.jsonc`: Cloudflare Worker AI 튜터 프록시
- `assets_모둠활동지_html/`: 경량화된 활동지 WebP 배경 이미지 및 서브셋 폰트

## 로컬 실행

```bash
python -m http.server 8765 --bind 127.0.0.1
```

브라우저에서 아래 주소로 접속합니다.

```text
http://127.0.0.1:8765/index.html
```

## GitHub Pages 배포

1. `main` 브랜치 루트(`/`)에서 GitHub Pages가 자동 배포됩니다.
2. 변경 사항 커밋 후 `git push origin main`을 실행하면 `https://ionholic.github.io/future-job-worksheet/`에 반영됩니다.

## 인풋데이터 저장 및 불러오기

- 각 활동지 상단의 `JSON 저장` 버튼을 누르면 `future-job-report-input-v1` 스키마의 JSON 파일이 다운로드됩니다.
- `JSON 불러오기` 버튼으로 저장한 JSON을 다시 불러와 이어서 작성할 수 있습니다.
- 06차시 개인 활동지에서는 같은 브라우저의 05차시 작성 내용 또는 05차시 JSON 파일을 불러와 학교·모둠 정보와 직업 후보를 바로 채울 수 있습니다.
- 필드 연결 기준: `06_확정안/01_Figma최종본_기준_교안패키지/00_기준문서_및_인덱스/미래직업탐구_인풋데이터_필드맵.md`

## PDF 저장

각 활동지 화면에서 `PDF 저장 / 인쇄` 버튼을 누른 뒤, 브라우저 인쇄 창에서 대상을 `PDF로 저장`으로 선택합니다.

## AI 튜터 설정 (Cloudflare Worker)

AI 작성 팁 기능은 Cloudflare Worker를 통해 OpenAI Responses API를 호출합니다. OpenAI API 키는 절대 HTML, JavaScript, GitHub 저장소에 넣지 말고 Cloudflare secret(`OPENAI_API_KEY`)으로만 저장합니다.

### Worker 점검 및 배포

```bash
npm ci
npm run worker:check
npm run worker:deploy
```

### 참고

- 기본 모델은 `gpt-6-luna`이며, 모델 미지원 오류 시 `gpt-5.4-mini`로 자동 폴백됩니다.
- 비허용 `Origin` 요청은 `403`으로 차단되며, `wrangler.jsonc`의 `ALLOWED_ORIGIN`에 등록된 출처(`https://ionholic.github.io`, `127.0.0.1:8765` 등)만 허용합니다.
- 사용자가 작성한 학교/모둠/이름/날짜(`meta-*`) 입력칸은 AI 튜터 요청에서 제외됩니다.
