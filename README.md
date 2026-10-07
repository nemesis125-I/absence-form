# 결석신고서 웹 시스템

## 전체 구조 (Firebase)

- 학생/교사용 화면: GitHub Pages (`index.html`, `teacher.html`)
- 데이터: Firebase Firestore (`absences` 목록용 정보, `files` 서명·증빙사진)
- 교사 로그인: Firebase Authentication (이메일/비밀번호)
- 원본 양식: `form.png` (1190×1682 PNG에 Canvas로 글자·동그라미·서명을 그림)

## 설정

1. `firebase.js`의 `firebaseConfig`에 Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 설정 값을 붙여넣습니다.
   (공개되어도 되는 값입니다. 데이터 보호는 Firestore 보안 규칙이 담당합니다.)
2. `firebase.js`의 `TEACHER_EMAIL`은 Authentication에 만든 교사 계정, 보안 규칙의 `isTeacher()` 이메일과 같아야 합니다.
3. 교사 화면에서는 4자리 비밀번호만 입력하고, 코드가 뒤에 `PASSWORD_SUFFIX`를 붙여 Firebase에 로그인합니다.
4. 증빙사진은 브라우저에서 최대 1280px JPEG로 압축해 Firestore 문서에 저장합니다. (Cloud Storage 미사용)

## 이전 방식 (백업)

아래는 Firebase 이전 전의 Google Apps Script 방식 설명입니다. `config.js`에 웹 앱 주소가 기록으로 남아 있습니다.

## 전체 구조

- 학생/교사용 프론트엔드: GitHub Pages
- 백엔드: Google Apps Script Web App
- 데이터: Google Sheets
- 서명/증빙 사진: Google Drive
- 원본 양식: `form.png`
- Canvas: 원본 1190×1682 PNG에 직접 텍스트/동그라미/서명을 그림

## 1. Google Spreadsheet 만들기

1. Google Drive에서 새 Google 스프레드시트를 만듭니다.
2. 주소의 `/d/`와 `/edit` 사이 문자열이 Spreadsheet ID입니다.
3. Apps Script 프로젝트의 `Code.gs`에서 `SPREADSHEET_ID`에 붙여넣습니다.

## 2. Google Drive 폴더

1. Google Drive에 `결석신고서_첨부파일` 폴더를 만듭니다.
2. 폴더 주소 마지막의 ID를 `DRIVE_FOLDER_ID`에 붙여넣습니다.

## 3. Apps Script

1. https://script.google.com/ 접속
2. 새 프로젝트 생성
3. `Code.gs` 전체를 붙여넣기
4. `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, `TEACHER_PASSWORD_HASH` 수정
5. `setup` 함수를 한 번 실행해 권한 승인
6. 배포 → 새 배포 → 웹 앱
7. 실행 사용자: 나
8. 액세스 권한: 모든 사용자
9. 배포 후 Web App URL 복사

## 4. 비밀번호 해시

교사 비밀번호의 `hash4()` 결과를 Apps Script의 `TEACHER_PASSWORD_HASH`에 넣습니다.

## 5. GitHub Pages

`config.js`의 `GAS_URL`에 Apps Script Web App URL을 넣은 뒤 전체 파일을 GitHub 저장소에 업로드합니다.

Settings → Pages → Deploy from a branch → main → /(root) → Save.

## 주의

Apps Script Web App은 브라우저 CORS 제약 때문에 프론트엔드에서 GET은 JSONP, 쓰기는 hidden form POST 방식으로 연결했습니다.

현재 공휴일 데이터는 2026~2027년의 주요 관공서 공휴일을 내장했습니다. 학교 재량휴업일은 자동 반영하지 않으며 학생/교사가 결석일수를 수정할 수 있습니다.

원본 양식 좌표는 1190×1682 PNG 기준으로 1차 배치한 값입니다. 실제 출력 테스트 후 `teacher.js`의 `drawForm()` 좌표를 1~5px 단위로 조정하면 됩니다.
