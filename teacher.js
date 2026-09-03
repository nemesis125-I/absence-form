let records=[], current=null, loggedIn=false;
const $=id=>document.getElementById(id);
function showMsg(id,text,error=false){const e=$(id);e.hidden=false;e.textContent=text;e.className="message"+(error?" error":"")}
function hash4(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
function jsonp(params){
  return new Promise((resolve,reject)=>{
    const cb="cb_"+Date.now()+"_"+Math.random().toString(16).slice(2);
    const script=document.createElement("script");
    const q=new URLSearchParams({...params,callback:cb});
    window[cb]=(data)=>{delete window[cb];script.remove();resolve(data)};
    script.onerror=()=>{delete window[cb];script.remove();reject(new Error("서버 응답을 받지 못했습니다."))};
    script.src=CONFIG.GAS_URL+"?"+q.toString();document.body.appendChild(script);
  });
}
function postToGas(data){
  const form=document.createElement("form");form.method="POST";form.action=CONFIG.GAS_URL;form.target="postFrame";form.style.display="none";
  Object.entries(data).forEach(([k,v])=>{const i=document.createElement("input");i.type="hidden";i.name=k;i.value=v??"";form.appendChild(i)});
  document.body.appendChild(form);form.submit();form.remove();
}
async function loadRecords(){
  showMsg("listMessage","목록을 불러오는 중...");
  try{
    const data=await jsonp({action:"list",auth:hash4(CONFIG.TEACHER_PASSWORD)});
    if(!data.ok)throw new Error(data.message||"목록을 불러오지 못했습니다.");
    records=data.records||[];renderList();$("listMessage").hidden=true;
  }catch(e){showMsg("listMessage",e.message,true)}
}
function renderList(){
  const g=$("gradeFilter").value,c=$("classFilter").value;
  const filtered=records.filter(r=>(!g||String(r.grade)===g)&&(!c||String(r.classNo)===c));
  $("list").innerHTML=filtered.length?filtered.map(r=>`
    <div class="item" data-id="${escapeHtml(r.id)}">
      <div class="item-top"><span>${escapeHtml(r.studentNo)} ${escapeHtml(r.studentName)}</span><span class="status ${r.status==="확인완료"?"done":""}">${escapeHtml(r.status||"확인대기")}</span></div>
      <div>${escapeHtml(r.startDate)} ~ ${escapeHtml(r.endDate)} · ${escapeHtml(r.reasonType)}</div>
      <div class="hint">제출일 ${escapeHtml(r.submitDate)}</div>
    </div>`).join(""):"<div class='card'>제출된 결석신고서가 없습니다.</div>";
  document.querySelectorAll(".item").forEach(x=>x.addEventListener("click",()=>openDetail(x.dataset.id)));
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function openDetail(id){
  const meta=records.find(r=>r.id===id);if(!meta)return;
  $("detail").hidden=false;$("list").hidden=true;$("detailTitle").textContent=`${meta.studentNo} ${meta.studentName} · 결석신고서`;
  showMsg("detailMessage","상세 자료를 불러오는 중...");
  try{
    const data=await jsonp({action:"detail",auth:hash4(CONFIG.TEACHER_PASSWORD),id});
    if(!data.ok)throw new Error(data.message||"상세 자료를 불러오지 못했습니다.");
    current=data.record;
    document.querySelectorAll('input[name="checkMethod"]').forEach(x=>x.checked=(current.checkMethods||[]).includes(x.value));
    $("checkExtra").value=current.checkExtra||"";$("detailMessage").hidden=true;
    await drawForm(current);
  }catch(e){showMsg("detailMessage",e.message,true)}
  window.scrollTo({top:0,behavior:"smooth"});
}
function drawText(ctx,text,x,y,size=28,align="left"){ctx.save();ctx.font=`${size}px "Noto Sans KR","Malgun Gothic",sans-serif`;ctx.fillStyle="#111";ctx.textAlign=align;ctx.textBaseline="middle";ctx.fillText(text,x,y);ctx.restore()}
function circle(ctx,x,y,r){ctx.save();ctx.strokeStyle="#111";ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.restore()}
async function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src})}
async function drawForm(r){
  const canvas=$("formCanvas"),ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
  const bg=await loadImage("form.png");ctx.drawImage(bg,0,0,canvas.width,canvas.height);
  // 좌표는 form.png(1190x1682) 픽셀 분석으로 정밀 보정한 값
  drawText(ctx,`${r.grade}`,882,219,27,"center");drawText(ctx,`${r.classNo}`,970,219,27,"center");drawText(ctx,`${r.number}`,1032,219,27,"center");
  drawText(ctx,r.studentName,918,258,27,"left");
  if(r.reasonType==="질병") circle(ctx,365,336,24); else circle(ctx,423,336,22);
  drawText(ctx,r.startDate.slice(2,4),337,375,24,"center");
  drawText(ctx,String(Number(r.startDate.slice(5,7))),387,375,24,"center");
  drawText(ctx,String(Number(r.startDate.slice(8,10))),440,375,24,"center");
  drawText(ctx,r.endDate.slice(2,4),566,375,24,"center");
  drawText(ctx,String(Number(r.endDate.slice(5,7))),615,375,24,"center");
  drawText(ctx,String(Number(r.endDate.slice(8,10))),668,375,24,"center");
  drawText(ctx,String(r.absenceDays),742,375,24,"center");
  drawText(ctx,r.reasonDetail,300,430,24,"left");
  drawText(ctx,r.submitDate.slice(2,4),542,896,23,"center");
  drawText(ctx,String(Number(r.submitDate.slice(5,7))),589,896,23,"center");
  drawText(ctx,String(Number(r.submitDate.slice(8,10))),645,896,23,"center");
  drawText(ctx,r.studentSigner,715,937,22,"left");
  drawText(ctx,r.guardianName,715,970,22,"left");
  if(r.studentSignData) await drawSignature(ctx,r.studentSignData,790,917,80,40);
  if(r.guardianSignData) await drawSignature(ctx,r.guardianSignData,790,952,80,40);
  if(r.reasonType==="질병") circle(ctx,462,1221,22); else circle(ctx,528,1221,22);
  const cm=[...(r.checkMethods||[])]; const method=cm.join(", ")+(r.checkExtra?` / ${r.checkExtra}`:"");
  drawText(ctx,method,330,1285,20,"left");
  const cd=r.checkDate||r.submitDate;
  drawText(ctx,cd.slice(2,4),543,1348,22,"center");
  drawText(ctx,String(Number(cd.slice(5,7))),591,1348,22,"center");
  drawText(ctx,String(Number(cd.slice(8,10))),646,1348,22,"center");
}
function formatKorDate(s){return `${s.slice(0,4)}년 ${Number(s.slice(5,7))}월 ${Number(s.slice(8,10))}일`}
async function drawSignature(ctx,data,x,y,w,h){try{const i=await loadImage(data);ctx.drawImage(i,x,y,w,h)}catch(e){}}
$("loginBtn").addEventListener("click",async()=>{
  if($("password").value!==CONFIG.TEACHER_PASSWORD){showMsg("loginError","비밀번호가 올바르지 않습니다.",true);return}
  loggedIn=true;$("loginPanel").hidden=true;$("app").hidden=false;await loadRecords();
});
$("password").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginBtn").click()});
$("gradeFilter").addEventListener("change",renderList);$("classFilter").addEventListener("change",renderList);$("reloadBtn").addEventListener("click",loadRecords);
$("closeDetail").addEventListener("click",()=>{$("detail").hidden=true;$("list").hidden=false;current=null});
$("saveCheck").addEventListener("click",()=>{
  if(!current)return;
  const methods=[...document.querySelectorAll('input[name="checkMethod"]:checked')].map(x=>x.value);
  postToGas({action:"updateCheck",auth:hash4(CONFIG.TEACHER_PASSWORD),id:current.id,methods:methods.join("|"),extra:$("checkExtra").value.trim()});
  current.checkMethods=methods;current.checkExtra=$("checkExtra").value.trim();current.checkDate=new Date().toISOString().slice(0,10);drawForm(current);
  showMsg("detailMessage","확인내용 저장 요청을 보냈습니다.");
});
$("toggleDone").addEventListener("click",()=>{
  if(!current)return;const next=current.status==="확인완료"?"대기":"확인완료";
  postToGas({action:"toggleStatus",auth:hash4(CONFIG.TEACHER_PASSWORD),id:current.id,status:next});
  current.status=next;drawForm(current);renderList();showMsg("detailMessage",`상태를 ${next==="확인완료"?"확인 완료":"확인 대기"}로 변경했습니다.`);
});
$("deleteBtn").addEventListener("click",()=>{
  if(!current)return;
  $("detailMessage").hidden=false;
  $("detailMessage").textContent="삭제는 되돌릴 수 없습니다. 아래 입력란에 DELETE를 입력하면 삭제됩니다.";
  let box=document.getElementById("deleteConfirm");
  if(!box){
    box=document.createElement("div");
    box.id="deleteConfirm";
    box.innerHTML='<input id="deleteWord" placeholder="DELETE"><button id="reallyDelete" class="danger" type="button">삭제 확정</button>';
    $("detailMessage").appendChild(box);
    box.querySelector("#reallyDelete").addEventListener("click",()=>{
      if($("deleteWord").value!=="DELETE"){
        showMsg("detailMessage","DELETE를 정확히 입력해주세요.",true);
        return;
      }
      postToGas({action:"delete",auth:hash4(CONFIG.TEACHER_PASSWORD),id:current.id});
      records=records.filter(r=>r.id!==current.id);
      $("detail").hidden=true;$("list").hidden=false;renderList();
    });
  }
});
$("printBtn").addEventListener("click",()=>window.print());
$("savePngBtn").addEventListener("click",()=>{
  $("formCanvas").toBlob(blob=>{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`결석신고서_${current.studentNo}_${current.studentName}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},"image/png");
});
