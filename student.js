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

let evidenceData="";
$("evidenceYes").addEventListener("change",()=>{
  const on=$("evidenceYes").checked;
  $("evidenceNotice").hidden=!on; $("chooseEvidence").hidden=!on;
  if(!on){evidenceData="";$("evidenceFile").value="";$("evidenceName").textContent="";}
});
$("chooseEvidence").addEventListener("click",()=>$("evidenceFile").click());
$("evidenceFile").addEventListener("change",()=>{
  const f=$("evidenceFile").files[0]; if(!f)return;
  if(f.size>8*1024*1024){setMessage("증빙사진은 8MB 이하로 선택해주세요.","error");$("evidenceFile").value="";return;}
  const r=new FileReader(); r.onload=()=>{evidenceData=r.result;$("evidenceName").textContent=f.name;}; r.readAsDataURL(f);
});

function setupSignature(canvas){
  const ctx=canvas.getContext("2d"); let drawing=false, has=false;
  function pos(e){const r=canvas.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return{x:(p.clientX-r.left)*canvas.width/r.width,y:(p.clientY-r.top)*canvas.height/r.height}}
  function down(e){drawing=true;has=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault();}
  function move(e){if(!drawing)return;const p=pos(e);ctx.lineWidth=5;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault();}
  function up(){drawing=false}
  canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);
  return {clear(){ctx.clearRect(0,0,canvas.width,canvas.height);has=false},data(){return has?canvas.toDataURL("image/png"):""}};
}
const studentSig=setupSignature($("studentSign")), guardianSig=setupSignature($("guardianSign"));
document.querySelectorAll(".clear-sign").forEach(b=>b.addEventListener("click",()=>({studentSign:studentSig,guardianSign:guardianSig}[b.dataset.canvas]).clear()));

function postToGas(data){
  const form=document.createElement("form"); form.method="POST"; form.action=CONFIG.GAS_URL; form.target="postFrame"; form.style.display="none";
  Object.entries(data).forEach(([k,v])=>{const i=document.createElement("input");i.type="hidden";i.name=k;i.value=v??"";form.appendChild(i)});
  document.body.appendChild(form); form.submit(); form.remove();
}
$("studentForm").addEventListener("submit",e=>{
  e.preventDefault(); setMessage("");
  const p=parseStudentNo($("studentNo").value);
  if(!p){setMessage("학번은 5자리 숫자로 입력해주세요. 예: 30512","error");return;}
  if(!$("studentName").value.trim()){setMessage("이름을 입력해주세요.","error");return;}
  if(!$("reasonDetail").value.trim()){setMessage("사유 상세를 입력해주세요.","error");return;}
  if(!$("absenceDays").value || Number($("absenceDays").value)<1){setMessage("결석 일수를 확인해주세요.","error");return;}
  if(!studentSig.data()||!guardianSig.data()){setMessage("학생과 보호자 서명을 모두 입력해주세요.","error");return;}
  const btn=$("submitBtn"); btn.disabled=true; btn.textContent="제출 중...";
  postToGas({
    action:"submit",
    studentNo:$("studentNo").value, grade:p.grade, classNo:p.cls, number:p.no,
    studentName:$("studentName").value.trim(),
    reasonType:document.querySelector('input[name="reasonType"]:checked').value,
    reasonDetail:$("reasonDetail").value.trim(),
    startDate:$("startDate").value,endDate:$("endDate").value,
    absenceDays:$("absenceDays").value,submitDate:$("submitDate").value,
    evidenceYes:$("evidenceYes").checked?"Y":"N",evidenceData,
    studentSigner:$("studentSigner").value.trim(),studentSign:studentSig.data(),
    guardianName:$("guardianName").value.trim(),guardianSign:guardianSig.data()
  });
  $("studentForm").hidden=true;$("complete").hidden=false;
});
