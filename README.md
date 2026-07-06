# 미래직업탐구 활동지 웹서비스

브라우저에서 모둠 활동지와 개인 활동지를 작성하고, 인쇄 기능을 이용해 PDF로 저장할 수 있는 정적 웹서비스입니다.

## 구성

- `index.html`: 활동지 선택 화면
- `05차시_모둠활동지_PC작성용.html`: 모둠 활동지
- `06차시_개인활동지_직업탐구_PC작성용.html`: 개인 활동지
- `assets_모둠활동지_html/`: 활동지 이미지 자산

## 로컬 실행

```bash
python3 -m http.server 8765
```

브라우저에서 아래 주소로 접속합니다.

```text
http://127.0.0.1:8765/index.html
```

## GitHub Pages 배포

1. 이 폴더 내용을 GitHub 저장소의 루트에 업로드합니다.
2. GitHub 저장소에서 `Settings` > `Pages`로 이동합니다.
3. `Build and deployment`의 `Source`를 `Deploy from a branch`로 설정합니다.
4. Branch를 `main`, 폴더를 `/ (root)`로 선택하고 저장합니다.
5. 배포가 완료되면 Pages URL에서 `index.html`이 열립니다.

## PDF 저장

각 활동지 화면에서 `인쇄 / PDF 저장` 버튼을 누른 뒤, 브라우저 인쇄 창에서 대상을 `PDF로 저장`으로 선택합니다.

## AI 튜터 설정

AI 작성 팁 기능은 Cloudflare Worker를 통해 OpenAI API를 호출합니다. OpenAI API 키는 절대 HTML, JavaScript, GitHub 저장소에 넣지 말고 Cloudflare secret으로만 저장합니다.

### 1. Cloudflare 로그인

```bash
npx wrangler login
```

브라우저에서 Cloudflare 로그인을 완료합니다.

### 2. OpenAI API 키 secret 등록

이미 채팅이나 문서에 노출된 API 키는 폐기하고 새 키를 발급한 뒤 사용합니다.

```bash
npx wrangler secret put OPENAI_API_KEY
```

명령 실행 후 새 OpenAI API 키를 붙여넣습니다. 입력값은 Cloudflare secret으로 저장되며 코드에 기록되지 않습니다.

### 3. Worker 배포

```bash
npm run worker:deploy
```

배포가 완료되면 `https://future-job-worksheet-tutor.<계정명>.workers.dev` 형식의 URL이 출력됩니다.

### 4. 활동지에 Worker URL 연결

`tutor-config.js` 파일의 값을 배포된 Worker URL로 바꿉니다.

```js
window.TUTOR_API_URL = "https://future-job-worksheet-tutor.<계정명>.workers.dev";
```

수정 후 GitHub에 다시 push하면 GitHub Pages 활동지에서 `AI 작성 팁` 버튼이 실제로 동작합니다.

```bash
git add .
git commit -m "Configure AI tutor endpoint"
git push
```

### 참고

- 기본 모델은 `gpt-5.4-mini`입니다.
- CORS 허용 origin은 `https://ionholic.github.io`로 제한되어 있습니다.
- 사용자가 작성한 학교/이름 입력칸은 AI 튜터 요청에서 제외됩니다.
