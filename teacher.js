import { app, db, configReady, TEACHER_EMAIL, PASSWORD_SUFFIX } from "./firebase.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, orderBy, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth=getAuth(app);
let records=[], current=null;
const $=id=>document.getElementById(id);
function showMsg(id,text,error=false){const e=$(id);e.hidden=false;e.textContent=text;e.className="message"+(error?" error":"")}
function todayStr(){const t=new Date();return new Date(t.getTime()-t.getTimezoneOffset()*60000).toISOString().slice(0,10)}
async function loadRecords(){
  showMsg("listMessage","목록을 불러오는 중...");
  try{
    const snap=await getDocs(query(collection(db,"absences"),orderBy("createdAt","desc")));
    records=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderList();$("listMessage").hidden=true;
  }catch(e){console.error(e);showMsg("listMessage","목록을 불러오지 못했습니다. ("+(e.code||e.message)+")",true)}
}
function renderList(){
  const g=$("gradeFilter").value,c=$("classFilter").value;
  const filtered=records.filter(r=>(!g||String(r.grade)===g)&&(!c||String(r.classNo)===c));
  const detailEl=$("detail");
  const wasOpenId = (!detailEl.hidden && current) ? current.id : null;
  if(detailEl.parentElement===$("list")) $("app").appendChild(detailEl);
  $("list").innerHTML=filtered.length?filtered.map(r=>`
    <div class="item" data-id="${escapeHtml(r.id)}">
      <div class="item-top"><span>${escapeHtml(r.studentNo)} ${escapeHtml(r.studentName)}</span><span class="status ${r.status==="확인완료"?"done":""}">${r.status==="확인완료"?"확인완료":"확인대기"}</span></div>
      <div>${escapeHtml(r.startDate)} ~ ${escapeHtml(r.endDate)} · ${escapeHtml(r.reasonType)}${r.evidenceYes==="Y"?" · 증빙: "+escapeHtml(r.evidenceTitle||"있음"):""}</div>
      <div class="hint">제출일 ${escapeHtml(r.submitDate)}</div>
    </div>`).join(""):"<div class='card'>제출된 결석신고서가 없습니다.</div>";
  document.querySelectorAll(".item").forEach(x=>x.addEventListener("click",()=>openDetail(x.dataset.id, x)));
  if(wasOpenId){
    const matchEl=$("list").querySelector(`.item[data-id="${CSS.escape(wasOpenId)}"]`);
    if(matchEl) matchEl.insertAdjacentElement('afterend', detailEl);
    else detailEl.hidden=true;
  }
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function openDetail(id, itemEl){
  const meta=records.find(r=>r.id===id);if(!meta)return;
  const detailEl=$("detail");
  detailEl.hidden=false;
  if(itemEl) itemEl.insertAdjacentElement('afterend', detailEl);
  $("detailTitle").textContent=`${meta.studentNo} ${meta.studentName} · 결석신고서`;
  $("evidenceBox").hidden=true;$("evidenceImg").removeAttribute("src");
  showMsg("detailMessage","상세 자료를 불러오는 중...");
  current=meta;
  try{
    const f=await getDoc(doc(db,"files",id));
    if(current!==meta)return;
    Object.assign(meta,f.exists()?f.data():{});
    document.querySelectorAll('input[name="checkMethod"]').forEach(x=>x.checked=(meta.checkMethods||[]).includes(x.value));
    $("checkExtra").value=meta.checkExtra||"";$("checkDate").value=meta.checkDate||todayStr();
    document.querySelectorAll('input[name="reasonFix"]').forEach(x=>x.checked=x.value===meta.reasonType);
    $("detailMessage").hidden=true;
    if(meta.evidenceData){$("evidenceImg").src=meta.evidenceData;$("evidenceBox").hidden=false;}
    await drawForm(meta);
  }catch(e){console.error(e);showMsg("detailMessage","상세 자료를 불러오지 못했습니다. ("+(e.code||e.message)+")",true)}
  detailEl.scrollIntoView({behavior:"smooth", block:"start"});
}
function drawText(ctx,text,x,y,size=28,align="left"){ctx.save();ctx.font=`${size}px "Noto Sans KR","Malgun Gothic",sans-serif`;ctx.fillStyle="#111";ctx.textAlign=align;ctx.textBaseline="middle";ctx.fillText(text,x,y);ctx.restore()}
function circle(ctx,x,y,r){ctx.save();ctx.strokeStyle="#111";ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.restore()}
async function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src})}
function dText(ctx, text, x, y, w, opts){
  opts = opts || {};
  ctx.save();
  ctx.font = (opts.fs||20) + "px 'Noto Sans KR', 'Malgun Gothic', sans-serif";
  ctx.fillStyle = '#111';
  ctx.textBaseline = 'top';
  ctx.textAlign = opts.center ? 'center' : 'left';
  const tx = opts.center ? x + w/2 : x;
  if(opts.wrap){
    wrapLines(ctx, String(text), w, 2).forEach((line,i)=> ctx.fillText(line, tx, y + i*(opts.fs||18)*1.3));
  }else{
    ctx.fillText(String(text), tx, y);
  }
  ctx.restore();
}
function wrapLines(ctx, text, maxWidth, maxLines){
  const words = text.split(/\s+/);
  const lines = []; let line = '';
  for(const word of words){
    const test = line ? line+' '+word : word;
    if(ctx.measureText(test).width > maxWidth && line){
      lines.push(line); line = word;
      if(lines.length === maxLines) break;
    } else { line = test; }
  }
  if(line && lines.length < maxLines) lines.push(line);
  return lines.slice(0, maxLines);
}
function dEllipse(ctx, x, y, w, h){
  ctx.save();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();
}
function fmtYMD2(s){ if(!s) return {y:'',m:'',d:''}; s=String(s); return {y:s.slice(0,4), m:s.slice(5,7), d:s.slice(8,10)}; }

async function drawForm(r){
  const canvas=$("formCanvas"),ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
  const bg=await loadImage("form.png");ctx.drawImage(bg,0,0,canvas.width,canvas.height);

  const isSick = r.reasonType === "질병";
  const s = fmtYMD2(r.startDate), e = fmtYMD2(r.endDate), sub = fmtYMD2(r.submitDate);
  const cd = fmtYMD2(r.checkDate || todayStr());

  dText(ctx, r.grade, 870, 212, 34, {center:true});
  dText(ctx, r.classNo, 954, 212, 34, {center:true});
  dText(ctx, r.number, 1014, 212, 34, {center:true});
  dText(ctx, r.studentName, 916, 250, 160, {});

  if(isSick) dEllipse(ctx, 334, 320, 66, 34); else dEllipse(ctx, 458, 320, 192, 34);

  dText(ctx, s.y.slice(2), 317, 364, 28, {center:true});
  dText(ctx, s.m, 376, 364, 24, {center:true});
  dText(ctx, s.d, 428, 364, 24, {center:true});
  dText(ctx, e.y.slice(2), 545, 364, 28, {center:true});
  dText(ctx, e.m, 604, 364, 24, {center:true});
  dText(ctx, e.d, 656, 364, 24, {center:true});
  dText(ctx, String(r.absenceDays), 726, 364, 28, {center:true});

  dText(ctx, r.reasonDetail, 290, 410, 784, {wrap:true, fs:18});
  if(r.evidenceTitle) dText(ctx, r.evidenceTitle, 720, 457, 345, {fs:18});

  dText(ctx, sub.y.slice(2), 532, 888, 28, {center:true});
  dText(ctx, sub.m, 576, 888, 30, {center:true});
  dText(ctx, sub.d, 630, 888, 30, {center:true});

  dText(ctx, r.studentSigner, 720, 942, 152, {});
  if(r.studentSignData) await drawSignature(ctx, r.studentSignData, 874, 926, 136, 52);
  dText(ctx, r.guardianName, 720, 978, 152, {});
  if(r.guardianSignData) await drawSignature(ctx, r.guardianSignData, 874, 962, 136, 52);

  if(isSick) dEllipse(ctx, 426, 1206, 72, 34); else dEllipse(ctx, 564, 1206, 208, 34);

  const cm=[...(r.checkMethods||[])]; const method=cm.join(", ")+(r.checkExtra?` / ${r.checkExtra}`:"");
  dText(ctx, method, 320, 1276, 690, {fs:18});

  dText(ctx, cd.y.slice(2), 532, 1338, 28, {center:true});
  dText(ctx, cd.m, 576, 1338, 30, {center:true});
  dText(ctx, cd.d, 630, 1338, 30, {center:true});
}
function formatKorDate(s){return `${s.slice(0,4)}년 ${Number(s.slice(5,7))}월 ${Number(s.slice(8,10))}일`}
async function drawSignature(ctx,data,x,y,w,h){try{const i=await loadImage(data);ctx.drawImage(i,x,y,w,h)}catch(e){}}
function showApp(on){$("loginPanel").hidden=on;$("app").hidden=!on}
$("loginBtn").addEventListener("click",async()=>{
  if(!configReady){showMsg("loginError","firebase.js의 firebaseConfig 값이 아직 입력되지 않았습니다.",true);return}
  const pw=$("password").value.trim(); if(!pw){showMsg("loginError","비밀번호를 입력해주세요.",true);return}
  $("loginBtn").disabled=true;
  try{await signInWithEmailAndPassword(auth,TEACHER_EMAIL,pw+PASSWORD_SUFFIX);$("password").value="";$("loginError").hidden=true}
  catch(e){console.error(e);showMsg("loginError",e.code==="auth/too-many-requests"?"시도가 너무 많습니다. 잠시 후 다시 시도해주세요.":e.code==="auth/network-request-failed"?"인터넷 연결을 확인해주세요.":"비밀번호가 올바르지 않습니다.",true)}
  finally{$("loginBtn").disabled=false}
});
// 로그인 상태는 브라우저에 유지되므로 다시 접속하면 자동으로 목록이 열립니다.
onAuthStateChanged(auth,user=>{
  if(user&&user.email===TEACHER_EMAIL){showApp(true);loadRecords()}
  else{showApp(false);records=[];current=null;$("list").innerHTML="";$("detail").hidden=true}
});
$("logoutBtn").addEventListener("click",()=>signOut(auth));
$("password").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginBtn").click()});
$("gradeFilter").addEventListener("change",renderList);$("classFilter").addEventListener("change",renderList);$("reloadBtn").addEventListener("click",loadRecords);
$("closeDetail").addEventListener("click",()=>{$("detail").hidden=true;$("list").hidden=false;current=null});
$("saveCheck").addEventListener("click",async()=>{
  if(!current)return;const r=current;
  const methods=[...document.querySelectorAll('input[name="checkMethod"]:checked')].map(x=>x.value);
  const data={checkMethods:methods,checkExtra:$("checkExtra").value.trim(),checkDate:$("checkDate").value||todayStr()};
  showMsg("detailMessage","저장 중...");
  try{await updateDoc(doc(db,"absences",r.id),data);Object.assign(r,data);await drawForm(r);showMsg("detailMessage","확인내용을 저장했습니다.")}
  catch(e){console.error(e);showMsg("detailMessage","저장하지 못했습니다. ("+(e.code||e.message)+")",true)}
});
// 확인 일자를 바꾸면 미리보기에 바로 반영 (저장은 "확인내용 저장" 버튼)
$("checkDate").addEventListener("change",()=>{if(current)drawForm({...current,checkDate:$("checkDate").value})});
document.querySelectorAll('input[name="reasonFix"]').forEach(x=>x.addEventListener("change",async()=>{
  if(!current||!x.checked)return;const r=current,prev=r.reasonType;
  try{await updateDoc(doc(db,"absences",r.id),{reasonType:x.value});r.reasonType=x.value;renderList();await drawForm({...r,checkDate:$("checkDate").value});showMsg("detailMessage",`결석 사유를 '${x.value}'(으)로 수정했습니다.`)}
  catch(e){console.error(e);document.querySelectorAll('input[name="reasonFix"]').forEach(y=>y.checked=y.value===prev);showMsg("detailMessage","사유를 수정하지 못했습니다. ("+(e.code||e.message)+")",true)}
}));
$("toggleDone").addEventListener("click",async()=>{
  if(!current)return;const r=current;const next=r.status==="확인완료"?"대기":"확인완료";
  try{await updateDoc(doc(db,"absences",r.id),{status:next});r.status=next;renderList();showMsg("detailMessage",`상태를 ${next==="확인완료"?"확인 완료":"확인 대기"}로 변경했습니다.`)}
  catch(e){console.error(e);showMsg("detailMessage","상태를 바꾸지 못했습니다. ("+(e.code||e.message)+")",true)}
});
$("deleteBtn").addEventListener("click",()=>{
  if(!current)return;
  $("detailMessage").hidden=false;$("detailMessage").className="message";
  $("detailMessage").textContent="삭제는 되돌릴 수 없습니다. 아래 입력란에 DELETE를 입력하면 삭제됩니다.";
  const box=document.createElement("div");
  box.innerHTML='<input id="deleteWord" placeholder="DELETE"><button id="reallyDelete" class="danger" type="button">삭제 확정</button>';
  $("detailMessage").appendChild(box);
  box.querySelector("#reallyDelete").addEventListener("click",async()=>{
    if($("deleteWord").value!=="DELETE"){$("deleteWord").focus();return}
    const r=current;if(!r)return;
    try{
      const batch=writeBatch(db);batch.delete(doc(db,"absences",r.id));batch.delete(doc(db,"files",r.id));await batch.commit();
      records=records.filter(x=>x.id!==r.id);current=null;
      $("detail").hidden=true;$("list").hidden=false;renderList();
    }catch(e){console.error(e);showMsg("detailMessage","삭제하지 못했습니다. ("+(e.code||e.message)+")",true)}
  });
});
$("printBtn").addEventListener("click",()=>window.print());
$("savePngBtn").addEventListener("click",()=>{
  if(!current)return;
  $("formCanvas").toBlob(blob=>{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`결석신고서_${current.studentNo}_${current.studentName}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},"image/png");
});
$("saveEvidenceBtn").addEventListener("click",()=>{
  if(!current||!current.evidenceData)return;
  const a=document.createElement("a");a.href=current.evidenceData;a.download=`증빙_${current.studentNo}_${current.studentName}.jpg`;a.click();
});
if(!configReady) showMsg("loginError","firebase.js의 firebaseConfig 값이 아직 입력되지 않았습니다.",true);
