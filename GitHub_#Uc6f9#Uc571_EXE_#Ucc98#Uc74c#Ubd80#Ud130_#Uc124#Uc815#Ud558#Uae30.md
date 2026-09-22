# 기장중학교 교무 도우미: GitHub 웹앱·Apps Script·Windows EXE 처음부터 설정하기

이 문서는 현재 최신 배포 파일을 기준으로, **구글 시트 시간표 자동 갱신**, **교무 도우미 웹사이트 공개**, **Windows EXE 설치파일 생성**까지 순서대로 설정하는 방법입니다.

> 이미 사용 중인 저장소가 `teacher9sgoo-max/gijang-teacher-helper`라면 새 저장소를 만들 필요가 없습니다. 아래의 **2단계부터** 진행하면 됩니다.

## 0. 먼저 준비할 파일

첨부된 `gijang-teacher-helper-webapp.zip`을 다운로드하고 압축을 풉니다. 압축을 풀면 다음 파일과 폴더가 나와야 합니다.

```text
gijang-teacher-helper-webapp/
├─ index.html
├─ code.js
├─ dashboard-config.js
├─ manifest.webmanifest
├─ sw.js
├─ package.json
├─ electron-main.cjs
├─ preload.cjs
├─ icons/
│  ├─ icon-192.svg
│  └─ icon-512.svg
└─ .github/
   └─ workflows/
      └─ build-windows.yml
```

**중요:** ZIP 파일 자체를 GitHub에 올리지 않습니다. 반드시 ZIP의 압축을 푼 **안쪽 파일과 폴더**를 올려야 합니다.

---

## 1. 구글 스프레드시트에서 시간표 캐시 자동화 설정

먼저 시간표가 실제로 들어오는 구글 시트에서 Apps Script를 설정합니다.

1. 다음 구글 스프레드시트를 엽니다.

   `https://docs.google.com/spreadsheets/d/1_qIRbv44zWd9yv4yNzTQ0frXTvILl2-iejzPqhF8i2w/edit`

2. 위 메뉴에서 **확장 프로그램 → Apps Script**를 누릅니다.
3. 왼쪽의 `Code.gs`를 클릭합니다.
4. 기존 내용을 전부 지웁니다.
5. 압축을 푼 폴더의 `code.js`를 메모장으로 열고 내용을 전부 복사합니다.
6. Apps Script의 `Code.gs`에 붙여넣고 저장합니다.
7. Apps Script 화면을 닫고 구글 시트 화면을 브라우저에서 새로고침합니다.

새로고침하면 시트 상단 메뉴에 아래 메뉴가 나타납니다.

```text
시간표 관리
```

### 시간표를 지금 즉시 받아오기

1. 시트 상단의 **시간표 관리**를 누릅니다.
2. **↻ 시간표 캐시 지금 업데이트**를 누릅니다.
3. 처음이면 권한 요청이 나오므로 본인 Google 계정을 선택하고 허용합니다.
4. 완료 메시지가 뜨면 아래의 `시간표 캐시` 탭을 엽니다.

### 30분 자동 갱신 켜기

1. 시트 상단의 **시간표 관리**를 누릅니다.
2. **⏱ 30분 자동 업데이트 켜기**를 누릅니다.
3. 이 메뉴는 현재 시간표를 즉시 한 번 갱신하고, 그 이후 30분마다 컴시간 원본을 다시 받아 `시간표 캐시`를 자동 교체합니다.

상단 **ⓘ 시간표 캐시 상태 보기**를 누르면 캐시 행 수, 마지막 성공 동기화 시간, 자동 갱신 활성 여부를 확인할 수 있습니다.

---

## 2. GitHub 저장소 열기

이미 만든 저장소를 사용합니다.

1. 다음 주소를 엽니다.

   `https://github.com/teacher9sgoo-max/gijang-teacher-helper`

2. 저장소 첫 화면에서 `main` 브랜치인지 확인합니다.
3. 기존 폴더 안에 예전 파일이 남아 있어도 됩니다. 다만 이번 파일은 **저장소 최상위**에 있어야 합니다.

최상위는 아래 주소처럼 저장소 이름 바로 다음 위치를 뜻합니다.

```text
https://github.com/teacher9sgoo-max/gijang-teacher-helper
```

`00. 학교 관리 프로그램` 같은 폴더를 클릭해 들어간 위치가 아닙니다.

---

## 3. 최신 파일을 GitHub 최상위에 업로드

### 가장 쉬운 방법: 파일·폴더를 한 번에 끌어놓기

1. 저장소 첫 화면에서 **Add file → Upload files**를 누릅니다.
2. 컴퓨터에서 압축을 푼 `gijang-teacher-helper-webapp` 폴더를 엽니다.
3. 아래 파일과 폴더를 모두 선택해 업로드 영역으로 끌어다 놓습니다.

```text
index.html
dashboard-config.js
manifest.webmanifest
sw.js
code.js
package.json
electron-main.cjs
preload.cjs
icons/
.github/
```

4. 기존 파일이 있다는 경고가 나와도 최신 파일로 교체하면 됩니다.
5. 아래 `Commit changes` 버튼을 누릅니다.

업로드 후 저장소 첫 화면이 아래처럼 보이면 정상입니다.

```text
.github/
icons/
code.js
dashboard-config.js
electron-main.cjs
index.html
manifest.webmanifest
package.json
preload.cjs
sw.js
```

GitHub는 폴더와 파일을 이름순으로 보여 주므로 `icons`나 `.github`가 위에 보이는 것은 정상입니다. 중요한 것은 `index.html`이 **폴더 안이 아니라 저장소 첫 화면에 직접 보이는 것**입니다.

### `.github` 폴더가 업로드되지 않을 때

`Actions`에서 EXE를 빌드하려면 아래 파일이 꼭 필요합니다.

```text
.github/workflows/build-windows.yml
```

웹 업로드에서 숨김 폴더가 올라가지 않으면, GitHub 저장소에서 **Add file → Create new file**을 누르고 파일 이름에 아래 경로를 정확히 입력합니다.

```text
.github/workflows/build-windows.yml
```

그 뒤 컴퓨터에서 `build-windows.yml`을 메모장으로 열어 내용을 전부 복사해 붙여넣고 `Commit new file`을 누릅니다.

---

## 4. 웹사이트 주소 활성화: GitHub Pages

1. 저장소 상단의 **Settings**를 누릅니다.
2. 왼쪽 메뉴의 **Pages**를 누릅니다.
3. `Build and deployment` 항목을 아래처럼 설정합니다.

| 항목 | 선택 값 |
|---|---|
| Source | `Deploy from a branch` |
| Branch | `main` |
| Folder | `/ (root)` |

4. **Save**를 누릅니다.
5. 1~3분 기다린 뒤 Pages 화면을 새로고침합니다.

웹사이트 주소는 아래입니다.

```text
https://teacher9sgoo-max.github.io/gijang-teacher-helper/
```

웹 화면이 이전 버전처럼 보이면 키보드에서 다음을 누릅니다.

```text
Ctrl + Shift + R
```

이 단축키는 브라우저에 저장된 이전 화면을 무시하고 최신 파일을 다시 받아옵니다.

---

## 5. Windows EXE 설치파일 만들기: GitHub Actions

1. GitHub 저장소 상단의 **Actions** 메뉴를 누릅니다.
2. 왼쪽 목록에서 **Build Windows installer**를 선택합니다.
3. 오른쪽의 **Run workflow**를 누릅니다.
4. 다시 나타나는 초록색 **Run workflow** 버튼을 누릅니다.
5. 실행이 끝날 때까지 기다립니다. 노란색은 실행 중, 초록색 체크는 완료입니다.
6. 완료된 실행을 클릭합니다.
7. 화면 아래 **Artifacts**에서 다음 파일을 다운로드합니다.

```text
gijang-teacher-helper-windows
```

다운로드한 ZIP을 풀면 Windows용 EXE 설치파일이 있습니다. 이 EXE를 다른 선생님에게 전달하면 됩니다.

### EXE 설치 후 자동 시작

다른 선생님은 EXE를 설치하고 앱을 처음 열 때 로그인 화면의 아래 항목을 체크하면 됩니다.

```text
컴퓨터 켜질 때 자동으로 실행
```

이미 설치한 뒤에는 앱 상단의 **자동 시작 설정** 버튼에서 켜거나 끌 수 있습니다.

> Windows 경고가 나오면 설치파일에 공인 코드 서명이 없어서 나타날 수 있습니다. 학교 내부 배포용 파일인 것을 확인한 뒤 `추가 정보 → 실행`을 선택합니다.

---

## 6. 다른 선생님에게 배포하는 방법

두 가지 방식이 있습니다.

| 방식 | 교사에게 전달할 것 | 사용 방법 |
|---|---|---|
| 웹사이트 | GitHub Pages 링크 | Edge 또는 Chrome에서 링크를 열고 로그인 |
| Windows 앱 | GitHub Actions에서 만든 EXE | EXE 설치 후 바탕화면·시작 메뉴에서 실행 |

공유할 웹사이트 주소는 아래입니다.

```text
https://teacher9sgoo-max.github.io/gijang-teacher-helper/
```

웹 화면의 **Windows EXE 설치파일** 버튼은 GitHub Release에 EXE를 올린 뒤 사용하면 됩니다. 우선은 GitHub Actions의 Artifacts에서 받은 EXE를 직접 전달해도 됩니다.

---

## 7. 수정할 때마다 반복하는 순서

| 수정 대상 | 해야 할 일 |
|---|---|
| 웹 화면 `index.html` | GitHub 최상위 `index.html` 교체 → Commit → 1~3분 대기 → 강력 새로고침 |
| 시간표 캐시 Apps Script | 시트의 `확장 프로그램 → Apps Script`에서 `Code.gs` 교체 → 저장 → 시트 새로고침 |
| Windows EXE | GitHub에 최신 파일 Commit → Actions에서 `Build Windows installer` 실행 → 새 Artifact 다운로드 |

시간표 원본을 즉시 반영할 때는 구글 시트 상단의 **시간표 관리 → ↻ 시간표 캐시 지금 업데이트**를 사용하면 됩니다.

---

## 마지막 확인 목록

```text
[ ] 구글 시트 상단에 ‘시간표 관리’ 메뉴가 보인다.
[ ] ‘시간표 캐시 지금 업데이트’를 누르면 시간표 캐시 탭에 행이 들어온다.
[ ] GitHub 저장소 최상위에 index.html이 있다.
[ ] GitHub Pages 주소가 열린다.
[ ] Actions에서 Build Windows installer를 실행했다.
[ ] Artifact에서 Windows EXE 파일을 내려받았다.
```
