import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import crypto from "crypto";
import { spawn } from "child_process";

const __filename=fileURLToPath(import.meta.url),__dirname=path.dirname(__filename);
const app=express(),PORT=Number(process.env.PORT||3000);
app.use(cors());app.use(express.json({limit:"20mb"}));
app.use(express.static(path.join(__dirname,"../frontend")));
app.use("/generated",express.static(path.join(__dirname,"generated")));

let ai=null;
function getAI(){
  if(!process.env.GROQ_API_KEY)throw new Error("GROQ_API_KEY is not configured. Copy backend/.env.example to backend/.env and set your key.");
  if(!ai)ai=new OpenAI({apiKey:process.env.GROQ_API_KEY,baseURL:"https://api.groq.com/openai/v1"});
  return ai;
}
const jobs=new Map();

const CHAT_SYSTEM=`You are SUPER AI STUDIO Chat — a general-purpose AI assistant, similar in behavior to ChatGPT or Claude.
Understand Tamil, English and Tanglish fluently. Reply naturally in the same language or mix the user uses.
For normal questions, answer the question directly. Do not ask the user to provide a topic when the user has already asked a clear question.
You can explain, translate, summarize, brainstorm, write, code, troubleshoot, and discuss everyday topics.
If an image is attached, inspect it and use what is actually visible in the image to answer the user's request. Never pretend you cannot see an attached image.
If the user asks for alt text / alternative text / accessibility text, write concise, accurate accessibility-focused alt text describing the important visible subject, action, setting, and relevant visible text. Do not invent details. Usually return only the alt text unless the user asks for an explanation.
You are text-output only: you can analyze images, but you do not claim to generate an image or video file.
Be helpful, direct, and conversational.`;

const STUDIO_SYSTEM=`You are SUPER AI STUDIO — Video / Script Studio.
Understand Tamil, English and Tanglish fluently and reply in the same language or mix the user uses.
This mode is specifically for video production: story development, scene-by-scene scripts, narration/voiceover, dialogue, shot lists, camera directions, visual prompts, transitions, pacing, subtitles, music/SFX ideas, editing plans, and long-form video structure.
When the user gives a story, convert it into a practical production-ready plan. For scripts, use clear scene numbers and include visuals, narration/dialogue, camera/shot, transition, and approximate duration when useful.
If an image is attached, use it as a visual reference when creating the script or shot plan.
Do not claim that a finished video file has been rendered unless a real rendering endpoint has returned one.
Be specific and production-ready.`;

function systemFor(mode){return mode==='studio'?STUDIO_SYSTEM:CHAT_SYSTEM;}
function hasVisionImages(images){return Array.isArray(images)&&images.some(x=>x&&typeof x.data==='string'&&x.data.startsWith('data:image/'));}
function visionInstruction(message,images){
  const lower=String(message||'').toLowerCase();
  if(!hasVisionImages(images))return null;
  if(/alt\s*text|alternative\s*text|accessibility|accessible caption/.test(lower)){
    return `The user attached ${images.length} image${images.length>1?'s':''} and wants alt text. Inspect the image(s) carefully. Return accurate, concise accessibility alt text. Mention the main subject, action, setting, and any important readable text. Do not guess identities or hidden details. If there are multiple images, label them Image 1, Image 2, etc.`;
  }
  return `The user attached ${images.length} image${images.length>1?'s':''}. Inspect them carefully and answer the user's request using visible evidence from the image(s). Do not ask for a topic if the user's request is already clear.`;
}
function buildUserContent(message,images){
  const content=[];
  if(message?.trim())content.push({type:'text',text:String(message)});
  for(const image of (Array.isArray(images)?images:[]).slice(0,5)){
    if(typeof image?.data==='string'&&image.data.startsWith('data:image/')){
      content.push({type:'image_url',image_url:{url:image.data}});
    }
  }
  return content.length===1&&content[0].type==='text'?content[0].text:content;
}
function buildHistory(history,message){
  const h=[...(Array.isArray(history)?history:[])];
  const last=h[h.length-1];
  if(last?.role==='user'&&String(last.content||'')===String(message||''))h.pop();
  return h.slice(-10).map(x=>({role:x.role==='assistant'?'assistant':'user',content:String(x.content||'')}));
}
function selectChatModel(images){
  return hasVisionImages(images)
    ? (process.env.GROQ_VISION_MODEL||'qwen/qwen3.6-27b')
    : (process.env.GROQ_MODEL||'llama-3.3-70b-versatile');
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"SUPER AI STUDIO",time:new Date().toISOString(),vision_model:process.env.GROQ_VISION_MODEL||'qwen/qwen3.6-27b'}));

app.post("/api/ai/chat",async(req,res)=>{
  try{
    const {message="",mode="chat",history=[],images=[]}=req.body||{};
    if(!message.trim()&&!hasVisionImages(images))return res.status(400).json({ok:false,message:"Message or image is required."});
    const input=buildHistory(history,message);
    const instruction=visionInstruction(message,images);
    if(instruction)input.push({role:'system',content:instruction});
    input.push({role:"user",content:buildUserContent(message,images)});
    const r=await getAI().chat.completions.create({
      model:selectChatModel(images),
      temperature:mode==="studio"?0.9:0.7,
      messages:[{role:"system",content:systemFor(mode)},...input]
    });
    res.json({ok:true,message:r.choices?.[0]?.message?.content?.trim()||"I couldn't generate a response."});
  }catch(e){console.error(e);res.status(500).json({ok:false,message:e.message||"AI request failed."})}
});

// Streaming chat supports normal text chat plus image understanding/alt text.
app.post("/api/ai/chat/stream",async(req,res)=>{
  try{
    const {message="",mode="chat",history=[],images=[]}=req.body||{};
    if(!message.trim()&&!hasVisionImages(images))return res.status(400).json({ok:false,message:"Message or image is required."});
    const input=buildHistory(history,message);
    const instruction=visionInstruction(message,images);
    if(instruction)input.push({role:'system',content:instruction});
    input.push({role:"user",content:buildUserContent(message,images)});
    res.setHeader("Content-Type","text/event-stream");
    res.setHeader("Cache-Control","no-cache");
    res.setHeader("Connection","keep-alive");
    res.flushHeaders?.();
    const stream=await getAI().chat.completions.create({
      model:selectChatModel(images),
      temperature:mode==="studio"?0.9:0.7,
      messages:[{role:"system",content:systemFor(mode)},...input],
      stream:true
    });
    req.on("close",()=>{try{stream.controller?.abort()}catch{}});
    for await(const part of stream){
      const t=part.choices?.[0]?.delta?.content;
      if(t)res.write(`data: ${JSON.stringify({token:t})}\n\n`);
    }
    res.write(`data: ${JSON.stringify({done:true})}\n\n`);
    res.end();
  }catch(e){
    console.error(e);
    try{res.write(`data: ${JSON.stringify({error:e.message||"AI request failed."})}\n\n`);res.end()}catch{}
  }
});

const PLAN_SYSTEM=`You are a professional long-form video director.
Convert a complete story into ONLY valid JSON:
{"title":"...","total_duration":300,"style":"...","scenes":[{"scene":1,"duration":8,"visual_prompt":"...","narration":"...","transition":"cut|fade|dissolve","camera":"..."}]}
Every scene must be 5-10 seconds. Sum durations EXACTLY to total_duration.
Preserve story order and visual consistency. For 300 seconds create about 30-60 scenes.`;

async function makePlan(prompt,total,clip,aspect){
 const r=await getAI().chat.completions.create({
  model:process.env.GROQ_MODEL||"llama-3.3-70b-versatile",
  response_format:{type:"json_object"},
  messages:[
   {role:"system",content:PLAN_SYSTEM},
   {role:"user",content:JSON.stringify({story:prompt,total_duration:total,preferred_clip:clip,aspect_ratio:aspect})}
  ]
 });
 let t=r.choices?.[0]?.message?.content?.trim();if(!t)throw new Error("Empty AI plan.");
 let p;try{p=JSON.parse(t)}catch{throw new Error("Invalid AI scene-plan JSON.")} 
 if(!Array.isArray(p.scenes)||!p.scenes.length)throw new Error("No scenes returned.");
 return p;
}
function run(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args);let err="";p.stderr.on("data",d=>err+=d);p.on("error",reject);p.on("close",c=>c?reject(new Error(err.slice(-3000))):resolve())})}
async function download(url,file){const r=await fetch(url);if(!r.ok)throw new Error("Download failed: "+r.status);await fs.writeFile(file,Buffer.from(await r.arrayBuffer()))}
async function providerGenerate(scene,aspect){
 const r=await fetch(process.env.VIDEO_GENERATION_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.VIDEO_API_KEY}`},
  body:JSON.stringify({prompt:scene.visual_prompt,duration:scene.duration,aspect_ratio:aspect})});
 const d=await r.json();if(!r.ok)throw new Error(d.message||"Video provider failed.");
 const id=d.id||d.job_id;if(!id)throw new Error("Provider returned no job id.");return id;
}
async function providerWait(id){
 for(let i=0;i<720;i++){
  const r=await fetch(process.env.VIDEO_STATUS_URL.replace(":id",encodeURIComponent(id)),{headers:{Authorization:`Bearer ${process.env.VIDEO_API_KEY}`}});
  const d=await r.json();if(!r.ok)throw new Error(d.message||"Status request failed.");
  const s=String(d.status||d.state||"processing").toLowerCase();
  if(["completed","complete","succeeded","success"].includes(s))return d.video_url||d.url||d.output_url;
  if(["failed","error","cancelled","canceled"].includes(s))throw new Error(d.message||"Video generation failed.");
  await new Promise(x=>setTimeout(x,5000));
 }
 throw new Error("Video provider timed out.");
}
async function concat(files,out){
 const list=out+".txt";await fs.writeFile(list,files.map(f=>`file '${f.replaceAll("'","'\\\\''")}'`).join("\n"));
 try{await run(process.env.FFMPEG_PATH||"ffmpeg",["-y","-f","concat","-safe","0","-i",list,"-c","copy",out])}
 catch{await run(process.env.FFMPEG_PATH||"ffmpeg",["-y","-f","concat","-safe","0","-i",list,"-c:v","libx264","-preset","medium","-crf","20","-c:a","aac","-movflags","+faststart",out])}
 await fs.rm(list,{force:true});
}
async function processLong(job){
 const dir=path.join(__dirname,"jobs",job.id);await fs.mkdir(dir,{recursive:true});
 try{
  job.status="planning";job.progress=2;job.message="AI is creating your scenes...";
  job.plan=await makePlan(job.prompt,job.duration,job.clip_seconds,job.aspect_ratio);
  await fs.writeFile(path.join(dir,"scene-plan.json"),JSON.stringify(job.plan,null,2));
  const clips=[];
  for(let i=0;i<job.plan.scenes.length;i++){
   if(job.cancelled)throw new Error("Cancelled.");
   job.status="generating";job.message=`Generating scene ${i+1}/${job.plan.scenes.length}`;job.progress=5+Math.round(i/job.plan.scenes.length*82);
   const id=await providerGenerate(job.plan.scenes[i],job.aspect_ratio),url=await providerWait(id);
   const file=path.join(dir,`scene-${String(i+1).padStart(3,"0")}.mp4`);await download(url,file);clips.push(file);
  }
  job.status="stitching";job.progress=90;job.message="Merging scenes...";
  await fs.mkdir(path.join(__dirname,"generated"),{recursive:true});
  const out=path.join(__dirname,"generated",job.id+".mp4");await concat(clips,out);
  job.status="completed";job.progress=100;job.message="Final video ready.";job.video_url="/generated/"+job.id+".mp4";
 }catch(e){job.status="failed";job.message=e.message;console.error("JOB",job.id,e)}
}
app.post("/api/video/long",async(req,res)=>{
 try{
  const {prompt,duration=300,aspect_ratio="16:9",clip_seconds=8}=req.body||{};
  const total=Number(duration),clip=Number(clip_seconds);
  if(!prompt?.trim())return res.status(400).json({ok:false,message:"Story text is required."});
  if(total<30||total>3600)return res.status(400).json({ok:false,message:"Duration must be 30-3600 seconds."});
  if(clip<5||clip>10)return res.status(400).json({ok:false,message:"Clip must be 5-10 seconds."});
  if(!process.env.VIDEO_GENERATION_URL||!process.env.VIDEO_STATUS_URL||!process.env.VIDEO_API_KEY)
   return res.status(501).json({ok:false,message:"Configure VIDEO_GENERATION_URL, VIDEO_STATUS_URL and VIDEO_API_KEY."});
  const id=crypto.randomUUID(),job={id,prompt:String(prompt),duration:total,aspect_ratio,clip_seconds:clip,status:"queued",progress:0,message:"Queued",cancelled:false};
  jobs.set(id,job);processLong(job);res.json({ok:true,id,status:"queued"});
 }catch(e){res.status(500).json({ok:false,message:e.message})}
});
app.get("/api/video/long/status/:id",(req,res)=>{
 const j=jobs.get(req.params.id);if(!j)return res.status(404).json({ok:false,message:"Job not found."});
 res.json({ok:true,id:j.id,status:j.status,progress:j.progress,message:j.message,video_url:j.video_url||null,plan:j.plan||null});
});
app.post("/api/video/long/cancel/:id",(req,res)=>{
 const j=jobs.get(req.params.id);if(!j)return res.status(404).json({ok:false,message:"Job not found."});
 j.cancelled=true;j.status="cancelled";j.message="Cancellation requested.";res.json({ok:true});
});

app.listen(PORT,()=>console.log(`SUPER AI STUDIO → http://localhost:${PORT}`));
