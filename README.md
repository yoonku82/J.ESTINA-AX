# J.ESTINA AX Connect 소스

공개 버전 4의 HTML/CSS/JavaScript와 이미지를 바탕으로 Codex에서 개발을 이어가는 저장소입니다.
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
- dist/sales-data.js: 일별 매출 데이터 검증 및 일·월·분기·연누적 집계
- dist/sales-dashboard.js, dist/sales-dashboard.css: 매출 현황판·억원 목표 비교·분기 그래프·ERP 조회 화면
- dist/crown.png, dist/product-samples.png: 이미지 자산
- .openai/hosting.json: 기존 ChatGPT Sites 식별 및 정적 배포 설정

## 기능 범위
현재는 데모입니다. AI API·그룹웨어·WORKS DRIVE와 실제 ERP에 연결되어 있지 않습니다. 매출 현황판의 ERP 조회 경로와 응답 검증은 구현되어 있으며, 실제 사용에는 회사 서버의 조회 전용 중계 API가 필요합니다.
경영 수치·상품·답변은 가상 샘플 또는 규칙 기반입니다.
등록 에이전트·즐겨찾기·게시물 등 일부 항목은 브라우저 로컬 저장소에 저장됩니다.
사용자 브라우저에 등록한 데이터는 이 소스 ZIP에 포함되지 않습니다.
API 키·계정 비밀번호는 포함되어 있지 않습니다.

## 매출 현황판

경영분석 → 매출 현황에서 일·월·분기·연초 누적 매출과 영업이익을 확인합니다. 주얼리·핸드백·로만손과 온라인·오프라인·글로벌 필터가 연동되며 금액 표시는 억원입니다. 분기별 매출·영업이익은 세로 막대와 표로 표시합니다. 진행 중인 기간은 조회 기준일까지의 부분 실적입니다.

목표는 브라우저에 기간·품목·채널·데이터 출처별로 저장합니다. 월·분기·연누적 목표는 같은 기간 내 조회일을 바꿔도 유지됩니다. 샘플 목표는 ERP 목표와 분리되며 회사 전체 공유 목표는 아닙니다. 홈 직군은 마케팅이 기본이고 전체는 마지막입니다.

기본은 샘플 데이터입니다. ‘ERP 데이터’를 선택하면 같은 출처의 `/api/erp/sales?year=YYYY`에 조회하고 화면을 보고 있을 때 60초마다 다시 확인합니다. 이는 푸시 방식이 아니며 ERP 등록에서 중계 서버까지 반영 시간도 필요합니다. 정적 Python 서버에는 API가 없으므로 ERP 선택 시 연결 실패와 샘플 유지 상태가 표시되는 것이 정상입니다. 실제 연동 계약·금액 단위·품목/채널 대응·인증과 잠정 손익 기준은 [ERP 연결 규약](docs/ERP_SALES_API.md)을 참고하세요.

매출은 반품·취소를 차감한 원 단위 정수로 집계한 뒤 억원으로 변환합니다. 이익 미제공은 0으로 만들지 않고 미집계로 표시합니다. 화면은 소수점 둘째 자리 반올림, CSV는 억원으로 변환한 원래 정밀도를 유지합니다. ERP 조회 오류나 잘못된 응답은 마지막 성공 데이터와 데이터 기준 시각을 유지하며 오류를 표시합니다.

## 검증

```sh
node --test tests/sales-data.test.js
node --check dist/sales-data.js
node --check dist/sales-dashboard.js
```

Playwright와 Chromium이 제공되는 환경에서는 위 로컬 서버를 먼저 켜고 다음을 실행합니다. 라이브 ERP 대신 테스트 응답을 사용해 필터·목표·CSV·주기 갱신·장애 시 동작을 검증합니다.

```sh
node tests/sales-dashboard.browser.cjs
```

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
