import { db, configReady } from "./firebase.js";
import { collection, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const today = new Date();
$("submitDate").value = new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);

function setMessage(text, type="info"){
  const el=$("message"); el.hidden=false; el.textContent=text;
  el.className = "message " + (type==="error" ? "error" : "");
}
function parseStudentNo(v){
  if(!/^\d{5}$/.test(v)) return null;
  const grade=Number(v[0]), cls=Number(v.slice(1,3)), no=Number(v.slice(3));
  if(grade<1||grade>3||cls<1||cls>99||no<1||no>99) return null;
  return {grade, cls, no};
}
$("studentNo").addEventListener("input", e=>{
  const p=parseStudentNo(e.target.value);
  $("classPreview").textContent=p ? `${p.grade}학년 ${p.cls}반 ${p.no}번` : "학번 5자리를 입력하세요. 예: 30512";
});
function isHoliday(d){
  const y=d.getFullYear(), m=d.getMonth()+1, day=d.getDate();
  const key=`${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  const holidays = new Set([
    "2026-01-01","2026-02-16","2026-02-17","2026-02-18","2026-03-01","2026-03-02",
    "2026-05-05","2026-05-24","2026-05-25","2026-06-06","2026-08-15","2026-08-17",
    "2026-09-24","2026-09-25","2026-09-26","2026-10-03","2026-10-05","2026-10-09","2026-12-25",
    "2027-01-01","2027-02-06","2027-02-07","2027-02-08","2027-02-09","2027-03-01",
    "2027-05-05","2027-05-13","2027-08-15","2027-08-16","2027-09-14","2027-09-15","2027-09-16",
    "2027-10-03","2027-10-04","2027-10-09","2027-10-11","2027-12-25","2027-12-27"
  ]);
  return d.getDay()===0 || d.getDay()===6 || holidays.has(key);
}
function calcDays(){
  const s=$("startDate").value,e=$("endDate").value;
  if(!s||!e) return;
  const start=new Date(s+"T00:00:00"), end=new Date(e+"T00:00:00");
  if(end<start){ $("absenceDays").value=""; $("daysHint").textContent="종료일은 시작일보다 빠를 수 없습니다."; return; }
  let n=0;
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)) if(!isHoliday(d)) n++;
  $("absenceDays").value=n;
  $("daysHint").textContent=`주말·공휴일 제외 자동 계산: ${n}일. 재량휴업일 등은 직접 수정하세요.`;
}
$("startDate").addEventListener("change",calcDays); $("endDate").addEventListener("change",calcDays);

let evidenceFile=null;
$("evidenceYes").addEventListener("change",()=>{
  const on=$("evidenceYes").checked;
  $("evidenceNotice").hidden=!on; $("chooseEvidence").hidden=!on;
  if(!on){evidenceFile=null;$("evidenceFile").value="";$("evidenceName").textContent="";}
});
$("chooseEvidence").addEventListener("click",()=>$("evidenceFile").click());
$("evidenceFile").addEventListener("change",()=>{
  const f=$("evidenceFile").files[0]; if(!f)return;
  if(f.size>15*1024*1024){setMessage("증빙사진은 15MB 이하로 선택해주세요.","error");$("evidenceFile").value="";return;}
  evidenceFile=f; $("evidenceName").textContent=f.name;
});
// 증빙사진을 최대 1280px, JPEG로 줄여 Firestore 문서 한도(보안 규칙 60만 자) 안에 들어가게 합니다.
async function compressImage(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("사진을 읽을 수 없습니다. 다른 사진을 선택해주세요."));i.src=url});
    let max=1280;
    for(let tries=0;tries<8;tries++){
      const scale=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement("canvas"); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
      const ctx=c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height);
      for(const q of [0.8,0.65,0.5]){const d=c.toDataURL("image/jpeg",q); if(d.length<580000) return d;}
      max=Math.round(max*0.8);
    }
    throw new Error("증빙사진 용량을 줄이지 못했습니다. 다른 사진을 선택해주세요.");
  }finally{URL.revokeObjectURL(url)}
}

function setupSignature(canvas){
  const ctx=canvas.getContext("2d"); let drawing=false, has=false;
  function pos(e){const r=canvas.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return{x:(p.clientX-r.left)*canvas.width/r.width,y:(p.clientY-r.top)*canvas.height/r.height}}
  function down(e){drawing=true;has=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault();}
  function move(e){if(!drawing)return;const p=pos(e);ctx.lineWidth=5;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault();}
  function up(){drawing=false}
  canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);
  return {clear(){ctx.clearRect(0,0,canvas.width,canvas.height);has=false},data(){if(!has)return "";const c=document.createElement("canvas");c.width=canvas.width/2;c.height=canvas.height/2;c.getContext("2d").drawImage(canvas,0,0,c.width,c.height);return c.toDataURL("image/png")}};
}
const studentSig=setupSignature($("studentSign")), guardianSig=setupSignature($("guardianSign"));
document.querySelectorAll(".clear-sign").forEach(b=>b.addEventListener("click",()=>({studentSign:studentSig,guardianSign:guardianSig}[b.dataset.canvas]).clear()));

$("studentForm").addEventListener("submit",async e=>{
  e.preventDefault(); $("message").hidden=true;
  if(!configReady){setMessage("시스템 설정이 아직 완료되지 않았습니다. 담임교사에게 알려주세요.","error");return;}
  const p=parseStudentNo($("studentNo").value);
  if(!p){setMessage("학번은 5자리 숫자로 입력해주세요. 예: 30512","error");return;}
  if(!$("studentName").value.trim()){setMessage("이름을 입력해주세요.","error");return;}
  if(!document.querySelector('input[name="reasonType"]:checked')){setMessage("결석 사유를 선택해주세요.","error");return;}
  if(!$("reasonDetail").value.trim()){setMessage("사유 상세를 입력해주세요.","error");return;}
  if(!$("startDate").value||!$("endDate").value){setMessage("결석 시작일과 종료일을 입력해주세요.","error");return;}
  if(!$("absenceDays").value || Number($("absenceDays").value)<1){setMessage("결석 일수를 확인해주세요.","error");return;}
  if($("evidenceYes").checked&&!evidenceFile){setMessage("증빙사진을 선택하거나 '증빙서류가 있음' 체크를 해제해주세요.","error");return;}
  const studentSignData=studentSig.data(), guardianSignData=guardianSig.data();
  if(!studentSignData||!guardianSignData){setMessage("학생과 보호자 서명을 모두 입력해주세요.","error");return;}
  if(studentSignData.length>=200000||guardianSignData.length>=200000){setMessage("서명이 너무 복잡합니다. 서명을 지우고 다시 해주세요.","error");return;}
  const btn=$("submitBtn"); btn.disabled=true; btn.textContent="제출 중...";
  try{
    const files={studentSignData,guardianSignData};
    if($("evidenceYes").checked) files.evidenceData=await compressImage(evidenceFile);
    const ref=doc(collection(db,"absences"));
    const batch=writeBatch(db);
    batch.set(ref,{
      createdAt:serverTimestamp(),
      studentNo:$("studentNo").value, grade:p.grade, classNo:p.cls, number:p.no,
      studentName:$("studentName").value.trim(),
      reasonType:document.querySelector('input[name="reasonType"]:checked').value,
      reasonDetail:$("reasonDetail").value.trim(),
      startDate:$("startDate").value, endDate:$("endDate").value,
      absenceDays:Number($("absenceDays").value), submitDate:$("submitDate").value,
      evidenceYes:$("evidenceYes").checked?"Y":"N",
      studentSigner:$("studentSigner").value.trim(),
      guardianName:$("guardianName").value.trim(),
      checkMethods:[], checkExtra:"", checkDate:"",
      status:"대기"
    });
    batch.set(doc(db,"files",ref.id),files);
    await batch.commit();
    $("studentForm").hidden=true; $("complete").hidden=false; window.scrollTo(0,0);
  }catch(err){
    console.error(err);
    setMessage(err.code==="permission-denied"?"제출 내용이 올바르지 않습니다. 입력 내용을 확인해주세요.":(err.message&&!err.code?err.message:"제출하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요."),"error");
    window.scrollTo(0,0);
  }finally{
    btn.disabled=false; btn.textContent="결석신고서 제출";
  }
});
