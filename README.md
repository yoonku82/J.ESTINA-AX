# J.ESTINA AX Connect 소스

현재 공개된 버전 4의 HTML/CSS/JavaScript 전체 소스와 이미지입니다.
공개 URL: https://jestina-ax-connect-demo.shrewdmule13.chatgpt.site
소스 커밋: 0ddc1c4e2421d416ce83e9fec0d0f118b4f8ce7a

## Codex에서 이어서 작업하기
1. ZIP을 해제합니다.
2. 해제한 JESTINA-AX-Connect 폴더를 Codex 작업 폴더 또는 GitHub 저장소로 엽니다.
3. CODEX_HANDOFF.md를 읽고 이어서 작업하도록 요청합니다.

## 로컬 실행
Python 3가 설치된 환경에서 프로젝트 폴더의 터미널을 열고 실행합니다.

```sh
python -m http.server 8000 --directory dist
```
Windows에서 python 명령이 없으면 py를 사용합니다.
브라우저에서 http://localhost:8000 에 접속합니다.
별도 npm 설치 또는 빌드 없이 실행되는 정적 웹사이트입니다.

## 파일 구조
- dist/index.html: 화면 구조와 섹션
- dist/style.css: 전체 디자인과 반응형 스타일
- dist/app.js: 기본 에이전트·검색·커뮤니티·모달
- dist/upgrade.js: 직군별 체험·경영분석·AI 구성원
- dist/refine.js: 27개 이름 목록·품목/채널 분석·상품 순위·전표·HR 헬퍼
- dist/crown.png, dist/product-samples.png: 이미지 자산
- .openai/hosting.json: 기존 ChatGPT Sites 식별 및 정적 배포 설정

## 기능 범위
현재는 데모입니다. AI API·ERP·그룹웨어·WORKS DRIVE 연동은 구현되어 있지 않습니다.
경영 수치·상품·답변은 가상 샘플 또는 규칙 기반입니다.
등록 에이전트·즐겨찾기·게시물 등 일부 항목은 브라우저 로컬 저장소에 저장됩니다.
사용자 브라우저에 등록한 데이터는 이 소스 ZIP에 포함되지 않습니다.
API 키·계정 비밀번호는 포함되어 있지 않습니다.

## 배포
정적 호스팅에는 dist 폴더를 배포하면 됩니다.
이 ZIP을 GitHub에 올리는 것만으로 기존 공개 사이트가 자동 업데이트되지는 않습니다.
기존 Sites를 수정할 때는 .openai/hosting.json의 project_id를 유지하고 Sites 배포 절차를 사용합니다.
다른 호스팅을 이용할 경우 .openai 폴더는 해당 호스팅에 필요하지 않습니다.

## GitHub에서 작업 확인

- 저장소: https://github.com/yoonku82/J.ESTINA-AX
- 페이지 소스: https://github.com/yoonku82/J.ESTINA-AX/tree/main/dist
- 커밋 이력: https://github.com/yoonku82/J.ESTINA-AX/commits/main/
- 날짜별 작업 내용: https://github.com/yoonku82/J.ESTINA-AX/blob/main/WORK_LOG.md

이 저장소의 `AGENTS.md`에는 Codex 수정 작업 완료 시 검증·작업 내역 기록·커밋·GitHub main 동기화를 수행하는 지침이 있습니다. 변경은 저장소에 기록되며, 항상 실행되는 백그라운드 동기화 서비스는 아닙니다. GitHub 쓰기 권한이 필요하며 실패하면 작업 결과에서 보고합니다.

Codex에서 이 저장소를 선택하고 수정 요청을 하면 같은 소스를 이어서 작업할 수 있습니다. GPT 프로젝트 대화 자체와 해당 프로젝트에서 별도로 만든 파일은 자동으로 가져오지 않습니다. GitHub 반영만으로 기존 ChatGPT Sites 공개 페이지가 재배포되지는 않습니다.
