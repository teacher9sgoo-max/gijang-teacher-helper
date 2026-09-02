# 일반 교사 로그인 수정본

- `index.html`: EXE가 최신 Apps Script `/exec` 주소를 사용하도록 수정
- `code.js`: 교사 ID와 비밀번호의 표시값 공백을 제거한 뒤 비교하도록 수정
- `timetable_sync.gs`: 참고용 별도 파일. `code.js`와 같은 Apps Script 프로젝트에 동시에 붙여넣지 않음

Apps Script 프로젝트에는 `code.js`만 전체 교체하고 배포를 새 버전으로 만든다. `timetable_sync.gs`의 상수는 `code.js`에 이미 포함되어 있으므로 중복 선언을 피하기 위해 별도 파일을 추가하지 않는다.
