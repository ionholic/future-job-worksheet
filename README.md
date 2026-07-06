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
