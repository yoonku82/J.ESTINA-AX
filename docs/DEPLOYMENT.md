# GitHub Pages 배포

2026-10-27(한국 시간) 저장소의 공개 표시와 소스 커밋 `2a6cf4e`의 공개 접근을 확인했습니다. 이 커밋의 dist 파일과 `.nojekyll`을 gh-pages 브랜치의 루트에 게시했습니다. 배포 브랜치 커밋은 `8caf69a5f861c8c061f348be263e750e30cc8d91`입니다.

GitHub Pages 활성화 API는 `403 Resource not accessible by integration`으로 거절됐습니다. 사이트 배포 완료는 확인되지 않았습니다. 저장소 소유자가 아래 설정을 한 번 적용해야 합니다.

1. https://github.com/yoonku82/J.ESTINA-AX/settings/pages 접속.
2. **빌드 및 배포 → 소스 → 브랜치에서 배포**(Deploy from a branch).
3. **브랜치 → gh-pages**, 폴더 **/(루트)** (`/(root)`).
4. **저장**. 자동 번역 상태에 따라 일부 표기가 다를 수 있습니다.

활성화 후 생성될 예상 주소는 `https://yoonku82.github.io/J.ESTINA-AX/`입니다. 지금 작동한다고 검증된 주소는 아닙니다. Pages 설정에 표시되는 실제 주소와 배포 결과를 확인해야 합니다.

main은 개발 소스와 작업 내역, gh-pages는 배포 파일을 보관합니다. main push만으로 gh-pages가 갱신되는 자동화는 아직 없습니다. 이후 Codex에 사이트 반영을 요청하면 dist 파일을 gh-pages에 추가 커밋으로 반영할 수 있습니다. 기존 배포 이력을 강제로 초기화하지 않고 보존해야 합니다.

Pages가 활성화되면 gh-pages 변경을 GitHub가 빌드·배포합니다. 완료 보고 전 HTML의 sales-dashboard.js 참조와 자산 응답 및 화면을 검증합니다. 정적 사이트는 사내 ERP 중계 API를 운영하지 않습니다. 기존 chatgpt.site 사이트는 이 설정으로 변경되지 않습니다.
