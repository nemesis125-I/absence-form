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
  const cd = fmtYMD2(r.checkDate || r.submitDate);

  dText(ctx, r.grade, 870, 212, 34, {center:true});
  dText(ctx, r.classNo, 954, 212, 34, {center:true});
  dText(ctx, r.number, 1014, 212, 34, {center:true});
  dText(ctx, r.studentName, 916, 250, 160, {});

  if(isSick) dEllipse(ctx, 334, 320, 66, 34); else dEllipse(ctx, 458, 320, 192, 34);

  dText(ctx, s.y, 324, 364, 28, {center:true});
  dText(ctx, s.m, 376, 364, 24, {center:true});
  dText(ctx, s.d, 428, 364, 24, {center:true});
  dText(ctx, e.y, 552, 364, 28, {center:true});
  dText(ctx, e.m, 604, 364, 24, {center:true});
  dText(ctx, e.d, 656, 364, 24, {center:true});
  dText(ctx, String(r.absenceDays), 726, 364, 28, {center:true});

  dText(ctx, r.reasonDetail, 290, 410, 784, {wrap:true, fs:18});

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
