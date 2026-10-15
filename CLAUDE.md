# 고전게임방 작업 규칙

- 화면을 만들거나 바꾸기 전에 **`docs/UX_PRINCIPLES.md`를 먼저 읽고**, 마지막의 체크리스트로 확인한다. 이 서비스의 사용자는 50대 이상이다.
- 소스는 `/home/claude/diamond`(shell.html, ui.js, 게임별 js, build.py)에서 만들고 `site/`로 빌드한 결과를 이 저장소에 복사한다.
- 배포는 Vercel 프로젝트 `gogeon-game-room`(git 연결 없음)에 `create_deployment`로 한다.
