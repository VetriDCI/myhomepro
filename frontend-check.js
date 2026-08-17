
window.addEventListener('error',e=>{console.error(e.error||e.message);});
window.addEventListener('unhandledrejection',e=>{console.error(e.reason);});
const $=id=>document.getElementById(id);
const makeId=()=>globalThis.crypto?.randomUUID?.()||('sais-'+Date.now()+'-'+Math.random().toString(36).slice(2));
let files=[],codeFiles=[],attachments=[],mode='chat',messages=[],sessionId=makeId(),activeController=null;

const defaultBackend=(window.location.protocol==='file:'?'http://localhost:3000':window.location.origin).replace(/\/$/,'');
const defaults={backend:defaultBackend,model:'AI',llm:'openai/gpt-oss-120b',mode:'chat',theme:'dark',enter:true,save:true,voice:false};
// V31: load persisted settings before using them. The old V30 build touched
// `settings` before its `let` declaration, which can stop the whole script.
const storedSettings=readJSON('sais-settings',{});
const MAX_VISION_IMAGES=5;
const MAX_VISION_BYTES=2*1024*1024;
function readJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(e){localStorage.removeItem(key);return fallback}}
let settings={...defaults,...(storedSettings&&typeof storedSettings==='object'?storedSettings:{})};
if(!settings.backend || settings.backend==='null' || settings.backend==='file://' || String(settings.backend).startsWith('file:')) settings.backend=defaultBackend;
settings.backend=String(settings.backend).replace(/\/$/,'');
// Always keep Enter-to-send enabled unless the user explicitly disabled it in Settings.
if(typeof settings.enter!=='boolean') settings.enter=true;

function applySettings(){
  const modelLabel=$('modelLabel');
  if(modelLabel) modelLabel.textContent=(settings.llm||'openai/gpt-oss-120b').split('/').pop();
  const theme=(settings.theme==='light'||settings.theme==='system'||settings.theme==='dark')?settings.theme:'dark';
  if(settings.theme!==theme) settings.theme=theme;
  const resolvedTheme=theme==='system'?(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):theme;
  document.body.dataset.theme=resolvedTheme;
  const themeBtn=$('themeBtn');
  if(themeBtn){themeBtn.textContent=resolvedTheme==='dark'?'☀':'◐';themeBtn.title=resolvedTheme==='dark'?'Switch to light theme':'Switch to dark theme';}
  if(resolvedTheme==='light'){
    document.documentElement.style.setProperty('--bg','#f4f5f7');document.documentElement.style.setProperty('--panel','#ffffff');
    document.documentElement.style.setProperty('--panel2','#f0f2f5');document.documentElement.style.setProperty('--line','#d7dbe1');document.documentElement.style.setProperty('--text','#151515');document.documentElement.style.setProperty('--muted','#66707b');
    document.documentElement.style.colorScheme='light';
  }else{
    document.documentElement.style.setProperty('--bg','#151515');document.documentElement.style.setProperty('--panel','#111419');
    document.documentElement.style.setProperty('--panel2','#181c22');document.documentElement.style.setProperty('--line','#2a3038');document.documentElement.style.setProperty('--text','#e5e5e5');document.documentElement.style.setProperty('--muted','#9aa3ad');
    document.documentElement.style.colorScheme='dark';
  }
  const b=[...document.querySelectorAll('.mode')].find(x=>x.dataset.mode===settings.mode);if(b)setMode(b);
  loadHistory();
}
function openSettings(){
  $('sModel').value=settings.model;$('sTheme').value=settings.theme;
  $('sEnter').checked=settings.enter;$('sSave').checked=settings.save;
  $('settingsModal').classList.add('show');
}
function closeSettings(){$('settingsModal').classList.remove('show')}
function saveSettings(){
  settings={...settings,backend:String(settings.backend||defaults.backend).replace(/\/$/,''),model:$('sModel').value.trim()||'AI',llm:settings.llm||defaults.llm,mode:settings.mode||'chat',theme:$('sTheme').value,enter:$('sEnter').checked,save:$('sSave').checked,voice:false};
  localStorage.setItem('sais-settings',JSON.stringify(settings));applySettings();closeSettings();toast('Settings saved');
}
function resetSettings(){settings={...defaults};localStorage.setItem('sais-settings',JSON.stringify(settings));openSettings();toast('Settings reset')}
function toggleTheme(){
  const current=settings.theme==='light'?'light':'dark';
  settings.theme=current==='dark'?'light':'dark';
  localStorage.setItem('sais-settings',JSON.stringify(settings));
  applySettings();
  toast(settings.theme==='dark'?'Dark theme':'Light theme');
}
function toast(t){const x=$('toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1800)}

function toggleMenu(){$('plusMenu').classList.toggle('show')}
document.addEventListener('click',e=>{if(!e.target.closest('.plus')&&!e.target.closest('#plusMenu'))$('plusMenu').classList.remove('show')});
function choose(type){
  $('plusMenu').classList.remove('show');
  const el=type==='folder'?$('folderInput'):$('allInput');
  el.value='';el.click();
}
$('allInput').onchange=e=>addAttachments(e.target.files);
$('folderInput').onchange=e=>addAttachments(e.target.files);

function fileIcon(f){
  const n=(f.name||'').toLowerCase();
  if(f.type?.startsWith('image/')) return '🖼️';
  if(f.type?.startsWith('video/')) return '🎬';
  if(f.type?.startsWith('audio/')) return '🎵';
  if(/\.pdf$/i.test(n)) return '📕';
  if(/\.(docx?|odt)$/i.test(n)) return '📘';
  if(/\.(xlsx?|ods|csv)$/i.test(n)) return '📊';
  if(/\.(pptx?|odp)$/i.test(n)) return '📙';
  if(/\.(zip|rar|7z|tar|gz)$/i.test(n)) return '🗜️';
  if(/\.(html?|css|js|ts|jsx|tsx|py|java|c|cpp|php|sql|json|xml|ya?ml|sh|tex|mathml)$/i.test(n)) return '💻';
  return '📄';
}
function renderAttachments(){
  const bar=$('previewbar');
  if(!bar)return;
  bar.innerHTML='';
  if(!attachments.length){bar.classList.remove('show');return;}
  bar.classList.add('show');
  attachments.forEach((f,i)=>{
    const p=document.createElement('div');p.className='preview';p.title=f.webkitRelativePath||f.name;
    if(f.type?.startsWith('image/')){const im=document.createElement('img');im.src=URL.createObjectURL(f);p.appendChild(im)}
    else if(f.type?.startsWith('video/')){const v=document.createElement('video');v.src=URL.createObjectURL(f);v.muted=true;p.appendChild(v)}
    else{p.innerHTML='<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px">'+fileIcon(f)+'</div>'}
    const x=document.createElement('button');x.className='x';x.textContent='×';x.onclick=()=>{attachments.splice(i,1);files=files.filter(q=>q!==f);codeFiles=codeFiles.filter(q=>q.__file!==f);renderAttachments();toggleSend();updateAttachmentHint()};p.appendChild(x);bar.appendChild(p);
  });
}
function clearFiles(){attachments=[];files=[];codeFiles=[];renderAttachments();toggleSend();updateAttachmentHint();$('allInput').value='';$('folderInput').value='';toast('Attachments removed')}

function fileAsDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
async function apiFetch(path, options={}){
  const base=String(settings.backend||defaultBackend).replace(/\/$/,'');
  try{
    return await fetch(base+path,options);
  }catch(e){
    if(e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(e.message||''))){
      throw new Error(`Backend connection failed. Start the SUPER AI STUDIO backend at ${base} and open the app from http://localhost:3000 (do not double-click index.html).`);
    }
    throw e;
  }
}

async function uploadSelectedFiles(list){
  const arr=[...list];
  const out=[];
  for(const f of arr){
    if(f.size>25*1024*1024){toast(`${f.name}: maximum upload size is 25 MB`);continue;}
    try{
      const data=await fileAsDataURL(f);
      const r=await apiFetch('/api/files/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:[{name:f.webkitRelativePath||f.name,type:f.type||'application/octet-stream',data}]})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.ok)throw new Error(d.message||'Upload failed');
      if(Array.isArray(d.files))out.push(...d.files);
    }catch(e){toast(`${f.name}: kept locally (${e.message})`);}
  }
  return out;
}

async function addAttachments(list){
  const incoming=[...list].filter(Boolean);
  if(!incoming.length)return;
  const accepted=[];
  for(const f of incoming){
    if(attachments.length+accepted.length>=40)break;
    if(attachments.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified))continue;
    accepted.push(f);
  }
  if(!accepted.length)return;
  attachments.push(...accepted);
  renderAttachments();toggleSend();updateAttachmentHint();

  // Real server upload: files are stored so attachments are not just visual previews.
  const uploaded=await uploadSelectedFiles(accepted);
  uploaded.forEach(u=>{
    const f=accepted.find(x=>(x.webkitRelativePath||x.name)===u.name || x.name===u.name);
    if(f)f.__upload=u;
  });

  for(const f of accepted){
    if(f.type.startsWith('image/')||f.type.startsWith('video/')) files.push(f);
    if(isCodeFile(f.name)){
      try{codeFiles.push({name:f.webkitRelativePath||f.name,content:await f.text(),__file:f});}catch{}
    }
    if(/\.zip$/i.test(f.name) && window.JSZip){
      try{
        const zip=await JSZip.loadAsync(f);
        const entries=Object.values(zip.files).filter(x=>!x.dir).slice(0,120);
        for(const entry of entries){
          const name=entry.name;
          if(/(^|\/)(node_modules|dist|build|\.git)(\/|$)/i.test(name))continue;
          if(isCodeFile(name) || /\.(txt|md|csv|json|xml|ya?ml)$/i.test(name)){
            if(codeFiles.length>=120)break;
            try{codeFiles.push({name,content:await entry.async('string'),__file:f})}catch{}
          }
        }
      }catch(e){toast('ZIP attached, but project scan failed')}
    }
    if(/\.docx$/i.test(f.name) && window.mammoth){
      try{const r=await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});codeFiles.push({name:f.name,content:r.value,__file:f})}catch{}
    }
    if(/\.pdf$/i.test(f.name) && window.pdfjsLib){
      try{const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;let text='';for(let pg=1;pg<=Math.min(pdf.numPages,40);pg++){const page=await pdf.getPage(pg);const tc=await page.getTextContent();text+=tc.items.map(x=>x.str).join(' ')+'\n'}codeFiles.push({name:f.name,content:text,__file:f})}catch{}
    }
    if(/\.(txt|md|csv|json|xml|ya?ml)$/i.test(f.name) && !isCodeFile(f.name)){
      try{codeFiles.push({name:f.name,content:await f.text(),__file:f})}catch{}
    }
  }
  renderAttachments();toggleSend();updateAttachmentHint();
}

function isCodeFile(name){return /\.(html?|css|js|mjs|cjs|ts|tsx|jsx|json|xml|ya?ml|md|txt|py|java|c|cc|cpp|h|hpp|cs|php|sql|sh|bash|mathml|tex)$/i.test(name)}

function setMode(btn){
  document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  mode=btn.dataset.mode;
  const ph={chat:'Message SUPER AI STUDIO...',studio:'Describe your video, story, scene plan, or edit...',math:'Enter an equation, math problem, or upload a math image...',code:'Paste code, describe an error, or upload a project to debug...'};
  $('prompt').placeholder=ph[mode]||ph.chat;
  const modeNoteEl=$('modeNote');if(modeNoteEl)modeNoteEl.textContent=mode==='studio'?'Video / Script Studio':mode==='math'?'Math • MathML • LaTeX • HTML • SVG':mode==='code'?'Code Doctor • Debug • Fix • Security':'General chat + image understanding';
  toggleSend();
}
function quick(t){$('prompt').value=t;resizePrompt($('prompt'));toggleSend();$('prompt').focus()}
function resizePrompt(t){
  t.style.height='auto';
  const h=Math.min(t.scrollHeight,190);
  t.style.height=h+'px';
  const wrap=document.querySelector('.composer-wrap');
  if(wrap)requestAnimationFrame(()=>{$('chat').style.paddingBottom=(wrap.offsetHeight+20)+'px'});
}
function toggleSend(){const b=$('send'),p=$('prompt');if(!b||!p)return;b.disabled=!p.value.trim()&&!attachments.length}
function setGenerating(on){
  const b=$('send');
  if(on){b.classList.add('stop');b.textContent='■';b.disabled=false;b.title='Stop generating';}
  else{b.classList.remove('stop');b.textContent='↑';b.title='Send';toggleSend();}
}
function handleSendClick(){
  if(activeController){activeController.abort();return}
  send();
}
function handleKey(e){
  // V31: Enter sends on desktop. Shift+Enter inserts a newline.
  // Capture-phase + preventDefault prevents the textarea/page from scrolling.
  if(e.target!==$('prompt') || e.key!=='Enter' || e.shiftKey || e.isComposing) return;
  if(settings.enter===false) return;
  e.preventDefault();
  e.stopPropagation();
  if(e.stopImmediatePropagation) e.stopImmediatePropagation();
  if(activeController) return; // Do not accidentally stop generation with Enter.
  handleSendClick();
}

const promptEl=$('prompt');
if(promptEl) promptEl.addEventListener('keydown',handleKey,{capture:true});

function escapeHTML(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function renderMarkdown(text){
  let src=String(text||'').replace(/\r\n?/g,'\n');
  const codeBlocks=[];
  src=src.replace(/```([\w+-]*)\n?([\s\S]*?)```/g,(_,lang,code)=>{
    const i=codeBlocks.length;
    const safe=escapeHTML(code.replace(/\n$/,''));
    codeBlocks.push('<div class="code-wrap"><button class="copy-code" type="button" data-code="'+encodeURIComponent(code.replace(/\n$/,''))+'">Copy</button><pre class="md-code"><code>'+safe+'</code></pre></div>');
    return `\u0000CODE${i}\u0000`;
  });
  let html=escapeHTML(src);
  html=html.replace(/^#{6}\s+(.+)$/gm,'<h6>$1</h6>')
    .replace(/^#{5}\s+(.+)$/gm,'<h5>$1</h5>')
    .replace(/^#{4}\s+(.+)$/gm,'<h4>$1</h4>')
    .replace(/^#{3}\s+(.+)$/gm,'<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm,'<h2>$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm,'<h1>$1</h1>')
    .replace(/^[-*]\s+(.+)$/gm,'<li>$1</li>')
    .replace(/^(\d+)\.\s+(.+)$/gm,'<li>$2</li>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/__(.+?)__/g,'<strong>$1</strong>')
    .replace(/`([^`\n]+)`/g,'<code class="md-inline">$1</code>')
    .replace(/\n{2,}/g,'</p><p>')
    .replace(/\n/g,'<br>');
  html=html.replace(/(?:<li>.*?<\/li>(?:<br>)?)+/g,m=>'<ul>'+m.replace(/<br>/g,'')+'</ul>');
  html='<p>'+html+'</p>';
  html=html.replace(/<p>\s*(<h[1-6]>)/g,'$1').replace(/(<\/h[1-6]>)\s*<\/p>/g,'$1');
  html=html.replace(/\u0000CODE(\d+)\u0000/g,(_,i)=>codeBlocks[Number(i)]);
  return html;
}


// Never expose model chain-of-thought, hidden reasoning, tool calls, or internal tags.
function cleanAIResponse(text){
  if(!text)return '';
  let out=String(text);
  const blocks=['think','thinking','analysis','reasoning','reflection','tool_call','tool','function','internal'];
  for(const tag of blocks){
    const re=new RegExp('<'+tag+'\\b[^>]*>[\\s\\S]*?<\\/'+tag+'>','gi');
    out=out.replace(re,'');
    // Hide an unfinished hidden block while the stream is still arriving.
    const openRe=new RegExp('<'+tag+'\\b[^>]*>[\\s\\S]*$','i');
    out=out.replace(openRe,'');
  }
  out=out.replace(/<\|[^>]+\|>/g,'');
  return out.trim();
}

function isChatNearBottom(){
  const chat=$('chat');
  if(!chat)return true;
  return chat.scrollHeight-chat.scrollTop-chat.clientHeight < 120;
}
let scrollButtonRAF = 0;
let suppressScrollLatestButton = false;

function updateScrollLatestButton(){
  if(scrollButtonRAF) cancelAnimationFrame(scrollButtonRAF);
  scrollButtonRAF = requestAnimationFrame(()=>{
    const btn=$('scrollLatestBtn');
    if(!btn)return;
    btn.classList.toggle('show', !suppressScrollLatestButton && !isChatNearBottom());
  });
}

function scrollChatToLatest(smooth=false){
  const chat=$('chat');
  const btn=$('scrollLatestBtn');
  if(!chat)return;

  // Prevent the jump button from flashing while a new message/stream is being added.
  suppressScrollLatestButton = true;
  if(btn) btn.classList.remove('show');

  chat.scrollTo({
    top: chat.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });

  if(smooth){
    window.setTimeout(()=>{
      suppressScrollLatestButton = false;
      updateScrollLatestButton();
    }, 420);
  }else{
    requestAnimationFrame(()=>{
      suppressScrollLatestButton = false;
      updateScrollLatestButton();
    });
  }
}

function addMessage(role,text,attached=[],outputs=[]){
  $('empty')?.remove();const m=document.createElement('div');m.className='msg '+(role==='user'?'user':'');
  m.innerHTML='<div class="avatar '+(role==='user'?'':'ai-assistant-avatar')+'">'+(role==='user'?'U':'<span class="ai-icon ai-icon-sm" aria-hidden="true"><span class="ring outer-ring"></span><span class="ring inner-ring"></span><span class="dot"></span></span>')+'</div><div class="bubble">'+(role==='user'?escapeHTML(text||'').replace(/\n/g,'<br>'):renderMarkdown(text||''))+'</div>';
  if(attached.length){const wrap=document.createElement('div');wrap.className='attachments';attached.forEach(f=>{
    const a=document.createElement('div');a.className='att';
    if(f.type?.startsWith('image/')||f.type?.startsWith('video/')){const u=URL.createObjectURL(f);const med=f.type.startsWith('image/')?document.createElement('img'):document.createElement('video');med.src=u;if(med.tagName==='VIDEO'){med.controls=true;med.muted=true}a.appendChild(med)}
    else{a.innerHTML='<div style="height:95px;display:flex;align-items:center;justify-content:center;font-size:34px">'+fileIcon(f)+'</div>'}
    const n=document.createElement('div');n.className='attname';n.textContent=f.webkitRelativePath||f.name;a.appendChild(n);wrap.appendChild(a);
  });m.querySelector('.bubble').appendChild(wrap)}
  if(Array.isArray(outputs)&&outputs.length) renderOutputs(m,outputs);
  $('messages').appendChild(m);scrollChatToLatest();return m
}
function outputKind(o){
  const t=String(o?.type||o?.mime||'').toLowerCase(), n=String(o?.name||o?.filename||o?.url||'').toLowerCase();
  if(t.includes('image')||/\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(n))return 'image';
  if(t.includes('video')||/\.(mp4|webm|mov|m4v)(\?|$)/.test(n))return 'video';
  if(t.includes('audio')||/\.(mp3|wav|m4a|ogg|aac)(\?|$)/.test(n))return 'audio';
  if(t.includes('pdf')||/\.pdf(\?|$)/.test(n))return 'pdf';
  return 'file';
}
function outputLabel(kind){return ({image:'Image',video:'Video',audio:'Audio',pdf:'PDF',file:'File'})[kind]||'File'}
// Only actual generated file outputs get a related download control. Normal text messages do not.
function renderOutputs(m,outputs){
  const wrap=document.createElement('div');wrap.className='output-list';
  outputs.filter(o=>o&&o.url).forEach(o=>{
    const kind=outputKind(o), card=document.createElement('div');card.className='output-card';
    const title=document.createElement('div');title.className='output-title';title.textContent=o.name||o.filename||outputLabel(kind);card.appendChild(title);
    if(kind==='image'){const img=document.createElement('img');img.src=o.url;img.alt=o.name||'Generated image';card.appendChild(img)}
    else if(kind==='video'){const v=document.createElement('video');v.src=o.url;v.controls=true;v.preload='metadata';card.appendChild(v)}
    else if(kind==='audio'){const a=document.createElement('audio');a.src=o.url;a.controls=true;card.appendChild(a)}
    else if(kind==='pdf'){const frame=document.createElement('iframe');frame.src=o.url;frame.title=o.name||'Generated PDF';card.appendChild(frame)}
    const dl=document.createElement('a');dl.className='output-download';dl.href=o.url;dl.download=o.name||o.filename||('SUPER-AI-STUDIO-'+kind);dl.target='_blank';dl.rel='noopener';dl.textContent='⬇ Download '+outputLabel(kind);card.appendChild(dl);
    wrap.appendChild(card);
  });
  if(wrap.children.length)m.querySelector('.bubble').appendChild(wrap);
}
function slug(s){return (s||'SUPER-AI-STUDIO-answer').replace(/[^a-z0-9-_]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,60)||'SUPER-AI-STUDIO-answer'}
function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}

function addTyping(){const m=document.createElement('div');m.className='msg';m.id='typing';m.innerHTML='<div class="avatar ai-assistant-avatar"><span class="ai-icon ai-icon-sm" aria-hidden="true"><span class="ring outer-ring"></span><span class="ring inner-ring"></span><span class="dot"></span></span></div><div class="bubble"><div class="typing"><i></i><i></i><i></i></div></div>';$('messages').appendChild(m);scrollChatToLatest()}
function removeTyping(){$('typing')?.remove()}

async function fileToVisionDataURL(file){
  if(!file.type.startsWith('image/'))return null;
  const raw=await file.arrayBuffer();
  if(raw.byteLength<=MAX_VISION_BYTES){
    let binary='';const bytes=new Uint8Array(raw);const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
    return `data:${file.type};base64,${btoa(binary)}`;
  }
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url});
    const max=2048,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.82);
  }finally{URL.revokeObjectURL(url)}
}
async function prepareVisionImages(attached){
  const images=attached.filter(f=>f.type.startsWith('image/')).slice(0,MAX_VISION_IMAGES);
  const out=[];
  for(const f of images){
    try{out.push({name:f.name,type:'image',data:await fileToVisionDataURL(f)})}catch{}
  }
  return out.filter(x=>x.data);
}
function updateAttachmentHint(){
  const note=$('modeNote');
  if(!note)return;
  const count=files.filter(f=>f.type.startsWith('image/')).length;
  note.textContent=count?(mode==='studio'?`Studio • ${count} image${count>1?'s':''}`:mode==='math'?`Math Vision • ${count} image${count>1?'s':''}`:`Vision • ${count} image${count>1?'s':''}`):codeFiles.length&&mode==='code'?`Code Doctor • ${codeFiles.length} file${codeFiles.length>1?'s':''}`:(mode==='studio'?'Video / Script Studio':mode==='math'?'Math • MathML • LaTeX • HTML • SVG':mode==='code'?'Code Doctor • Debug • Fix • Security':'General chat + image understanding');
}

async function send(){
  const text=$('prompt').value.trim();if(!text&&!attachments.length)return;
  const sentFiles=[...attachments];
  const visionImages=await prepareVisionImages(sentFiles);
  const sentCode=[...codeFiles];
  const uploadedFiles=sentFiles.map(f=>f.__upload).filter(Boolean);
  addMessage('user',text||'Code project attached',sentFiles);
  if(codeFiles.length){const names=codeFiles.slice(0,20).map(x=>x.name).join(', ');addMessage('user','🧑‍💻 Code files: '+names+(codeFiles.length>20?' …':''));}
  messages.push({role:'user',content:text,mode,files:sentFiles.map(f=>f.webkitRelativePath||f.name),codeFiles:sentCode.map(f=>f.name)});
  $('prompt').value='';resizePrompt($('prompt'));files=[];codeFiles=[];attachments=[];renderAttachments();toggleSend();updateAttachmentHint();saveCurrent();addTyping();
  activeController=new AbortController();const controller=activeController;setGenerating(true);

  // Accurate math route: simple arithmetic is calculated locally on the server
  // with mathjs BigNumber (64-digit precision), while normal questions still use Groq.
  const calcMatch=text.match(/^\s*(?:calculate|calc|solve)\s*:?\s*(.+)$/i);
  const simpleMath=/^[0-9+\-*/().,%^\s]+$/.test(text)&&/[+*/^%]/.test(text);
  if(calcMatch||simpleMath){
    try{
      const expression=(calcMatch?calcMatch[1]:text)
        .replace(/,/g,'').replace(/×/g,'*').replace(/÷/g,'/')
        .replace(/−/g,'-').replace(/x/gi,'*');
      const cr=await apiFetch('/api/calculate',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({expression}),
        signal:controller.signal
      });
      const cd=await cr.json();
      if(!cr.ok)throw new Error(cd.message||'Calculation failed');
      removeTyping();
      const answer='**Accurate calculation**\n\n`'+cd.expression+'`\n\n**Result:** '+cd.result;
      addMessage('assistant',answer);
      messages.push({role:'assistant',content:answer});
      saveCurrent();
      return;
    }catch(e){
      if(e.name==='AbortError')return;
      removeTyping();
      addMessage('assistant','❌ '+e.message);
      return;
    }finally{
      activeController=null;
      setGenerating(false);
    }
  }

  let full='';let pendingOutputs=[];
  try{
    const r=await apiFetch('/api/ai/chat/stream',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:text,mode,model:settings.llm,history:messages.slice(-10),images:visionImages,codeFiles:sentCode,attachments:uploadedFiles}),
      signal:controller.signal
    });
    if(!r.ok||!r.body){const d=await r.json().catch(()=>({}));throw new Error(d.message||'AI request failed')}
    removeTyping();
    const bubbleEl=addMessage('assistant','');const bubble=bubbleEl.querySelector('.bubble');
    const reader=r.body.getReader();const decoder=new TextDecoder();let buf='';
    while(true){
      const {done,value}=await reader.read();if(done)break;
      buf+=decoder.decode(value,{stream:true});
      const parts=buf.split('\n\n');buf=parts.pop();
      for(const part of parts){
        const line=part.trim();if(!line.startsWith('data:'))continue;
        let payload;try{payload=JSON.parse(line.slice(5).trim())}catch{continue}
        if(payload.error)throw new Error(payload.error);
        if(payload.token){full+=payload.token;const visible=cleanAIResponse(full);bubble.innerHTML=renderMarkdown(visible);scrollChatToLatest()} if(payload.output){pendingOutputs.push(payload.output)} if(Array.isArray(payload.outputs))pendingOutputs.push(...payload.outputs);
      }
    }
    const finalAnswer=cleanAIResponse(full);
    if(!finalAnswer)bubble.textContent="I couldn't generate a response.";
    else bubble.innerHTML=renderMarkdown(finalAnswer);
    if(pendingOutputs.length)renderOutputs(bubbleEl,pendingOutputs);
    messages.push({role:'assistant',content:finalAnswer});saveCurrent();
  }catch(e){
    removeTyping();
    if(e.name==='AbortError'){const stopped=cleanAIResponse(full);if(stopped.trim())messages.push({role:'assistant',content:stopped});else addMessage('assistant','⏹ Stopped.');saveCurrent()}
    else addMessage('assistant','❌ '+e.message);
  }finally{
    activeController=null;setGenerating(false);
  }
}

function newChat(){sessionId=makeId();messages=[];$('messages').innerHTML='<div class="empty" id="empty"><h1>Ready when you are.</h1></div>';files=[];codeFiles=[];attachments=[];renderAttachments();toggleSend();toast('New chat')}
function saveCurrent(){if(!settings.save||!messages.length)return;const all=readJSON('sais-chats',[]);const item={id:sessionId,title:messages.find(x=>x.role==='user')?.content?.slice(0,45)||'New chat',messages,updated:Date.now()};const idx=all.findIndex(x=>x.id===sessionId);if(idx>=0)all[idx]=item;else all.unshift(item);localStorage.setItem('sais-chats',JSON.stringify(all.slice(0,40)));loadHistory()}
function loadHistory(){const h=$('history');h.innerHTML='';const all=readJSON('sais-chats',[]);all.forEach(x=>{const d=document.createElement('div');d.className='chatrow '+(x.id===sessionId?'active':'');d.innerHTML='<span class="dot"></span><span class="title">'+escapeHTML(x.title)+'</span><button class="del" title="Delete chat">✕</button>';d.onclick=()=>restoreChat(x);d.querySelector('.del').onclick=(e)=>{e.stopPropagation();deleteChat(x.id)};h.appendChild(d)})}
function deleteChat(id){
  if(!confirm('Delete this chat?'))return;
  const all=readJSON('sais-chats',[]).filter(x=>x.id!==id);
  localStorage.setItem('sais-chats',JSON.stringify(all));
  if(id===sessionId)newChat();
  loadHistory();toast('Chat deleted');
}
function restoreChat(x){sessionId=x.id;messages=x.messages||[];$('messages').innerHTML='';messages.forEach(m=>{if(m.role==='user'||m.role==='assistant')addMessage(m.role,m.content||'')});loadHistory()}
function clearHistory(){if(confirm('Clear saved chat history?')){localStorage.removeItem('sais-chats');loadHistory();toast('History cleared')}}
function insertPlainTextAtCursor(text){
  const p=$('prompt');
  const start=p.selectionStart ?? p.value.length, end=p.selectionEnd ?? start;
  if(typeof p.setRangeText==='function') p.setRangeText(text,start,end,'end');
  else p.value=p.value.slice(0,start)+text+p.value.slice(end);
  resizePrompt(p);toggleSend();p.focus();
}
function setupClipboard(){
  const p=$('prompt');
  p.addEventListener('paste',async e=>{
    const cd=e.clipboardData;
    const text=cd?.getData('text/plain')||'';
    const items=[...(cd?.items||[])];
    const imageFiles=items.map(i=>i.kind==='file'?i.getAsFile():null).filter(Boolean).filter(f=>f.type.startsWith('image/'));
    if(text){
      e.preventDefault();
      insertPlainTextAtCursor(text);
      if(imageFiles.length) await addAttachments(imageFiles);
      return;
    }
    if(imageFiles.length){e.preventDefault();await addAttachments(imageFiles);}
  });
  $('messages').addEventListener('click',async e=>{
    const b=e.target.closest('.copy-code');
    if(!b)return;
    try{
      const code=decodeURIComponent(b.dataset.code||'');
      await navigator.clipboard.writeText(code);
      const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,1200);
    }catch{toast('Copy failed — select the code and copy manually');}
  });
  if(window.matchMedia){
    const mq=matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener?.('change',()=>{if(settings.theme==='system')applySettings()});
  }
}

function setupDrop(){
  const c=$('composer');['dragenter','dragover'].forEach(ev=>c.addEventListener(ev,e=>{e.preventDefault();$('dropzone').classList.add('show')}));
  ['dragleave','drop'].forEach(ev=>c.addEventListener(ev,e=>{e.preventDefault();$('dropzone').classList.remove('show')}));
  c.addEventListener('drop',e=>addAttachments(e.dataTransfer.files));
}

// Mobile history drawer and chat jump controls.
// Desktop v18 layout is unchanged.
(function setupV18MobileUX(){
  const btn=$('mobileHistoryBtn'), overlay=$('mobileHistoryOverlay'), side=document.querySelector('.sidebar');
  const open=()=>{side?.classList.add('mobile-open');overlay?.classList.add('show')};
  const close=()=>{side?.classList.remove('mobile-open');overlay?.classList.remove('show')};
  btn?.addEventListener('click',open);
  overlay?.addEventListener('click',close);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  document.querySelector('.history')?.addEventListener('click',()=>{if(window.innerWidth<=820)close()});

  const chat=$('chat');
  const scrollLatestBtn=$('scrollLatestBtn');
  scrollLatestBtn?.addEventListener('click',()=>scrollChatToLatest(true));
  chat?.addEventListener('scroll',updateScrollLatestButton,{passive:true});
  window.addEventListener('resize',updateScrollLatestButton);
  updateScrollLatestButton();
})();

setupClipboard();setupDrop();applySettings();renderAttachments();toggleSend();resizePrompt($('prompt'));updateAttachmentHint();
window.addEventListener('beforeunload',()=>{try{activeController?.abort()}catch{}});
(async()=>{try{const r=await apiFetch('/api/health');if(!r.ok)throw new Error('health');}catch(e){console.warn('SUPER AI STUDIO backend:',e.message)}})();
