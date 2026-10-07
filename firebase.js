// Firebase 연결 설정
// firebaseConfig는 공개되어도 되는 값입니다. 데이터 보호는 Firestore 보안 규칙이 담당합니다.
// Firebase 콘솔 → 프로젝트 설정(톱니바퀴) → 내 앱 → SDK 설정의 값을 그대로 붙여넣으세요.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBkIO3k4L8mwFlXfXXmMkzshoPqfkJ5VFc",
  authDomain: "absence-form-9a72b.firebaseapp.com",
  projectId: "absence-form-9a72b",
  storageBucket: "absence-form-9a72b.firebasestorage.app",
  messagingSenderId: "94695506068",
  appId: "1:94695506068:web:2540135ce7bf5d4e563481"
};

// 교사 계정 이메일 (보안 규칙의 isTeacher()에 적힌 이메일과 같아야 합니다)
export const TEACHER_EMAIL = "teacher@example.com";
// 교사 화면에서 입력한 4자리 뒤에 붙여 Firebase 비밀번호로 사용합니다.
export const PASSWORD_SUFFIX = "_absence";

export const configReady = !Object.values(firebaseConfig).some(v => v.includes("붙여넣기"));
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
