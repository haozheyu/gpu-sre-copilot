// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import type {Media} from './types'
function waitEvent(target:EventTarget,event:string,action?:()=>void){return new Promise<void>((resolve,reject)=>{
  const timeout=setTimeout(()=>end(Error('媒体读取超时，请换一个文件重试。')),20000)
  const ok=()=>end();const bad=()=>end(Error('当前设备不能解码此媒体，请转换为 JPEG、MP4 或 WAV 后重试。'))
  function end(e?:Error){clearTimeout(timeout);target.removeEventListener(event,ok);target.removeEventListener('error',bad);e?reject(e):resolve()}
  target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});action?.()
})}
function frame(el:HTMLVideoElement|HTMLImageElement){
  const w=el instanceof HTMLVideoElement?el.videoWidth:el.naturalWidth,h=el instanceof HTMLVideoElement?el.videoHeight:el.naturalHeight
  if(!w||!h)throw Error('无法读取图片尺寸。')
  const scale=Math.min(1,1600/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*scale);c.height=Math.round(h*scale);c.getContext('2d')!.drawImage(el,0,0,c.width,c.height);return c.toDataURL('image/jpeg',0.85)
}
export async function prepareMedia(file:File,onProgress:(s:string)=>void,signal?:AbortSignal):Promise<{media:Media;transcript?:string}>{
  signal?.throwIfAborted()
  if(file.size>60*1024*1024)throw Error('文件超过 60 MB，请压缩后重试。')
  const url=URL.createObjectURL(file)
  try{
    if(file.type.startsWith('image/')){const img=new Image();await waitEvent(img,'load',()=>{img.src=url});return {media:{kind:'image',name:file.name,images:[frame(img)],note:'照片已在本机压缩，长边不超过1600像素。'}}}
    if(file.type.startsWith('video/')){
      const video=document.createElement('video');video.muted=true;video.preload='auto';video.playsInline=true;await waitEvent(video,'loadeddata',()=>{video.src=url});
      if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>180)throw Error('视频需在 3 分钟以内，请先截取故障片段。')
      const images:string[]=[],times:number[]=[]
      for(let i=0;i<5;i++){const t=Math.max(0,Math.min(video.duration-0.05,video.duration*(i+.5)/5));onProgress(`本机抽帧 ${i+1}/5`);if(Math.abs(video.currentTime-t)>0.01)await waitEvent(video,'seeked',()=>{video.currentTime=t});images.push(frame(video));times.push(Math.round(t*10)/10)}
      video.removeAttribute('src');video.load();return {media:{kind:'video',name:file.name,images,note:`仅分析5张采样帧，时间点（秒）：${times.join('、')}。不含视频声音，不代表完整视频分析。`}}
    }
    if(file.type.startsWith('audio/')){
      onProgress('读取音频…');const ac=new AudioContext();let audio:AudioBuffer
      try{audio=await ac.decodeAudioData(await file.arrayBuffer())}finally{await ac.close()}
      if(audio.duration>120)throw Error('音频需在 2 分钟以内，请分段上传。')
      const offline=new OfflineAudioContext(1,Math.ceil(audio.duration*16000),16000),src=offline.createBufferSource();src.buffer=audio;src.connect(offline.destination);src.start();const rendered=await offline.startRendering()
      onProgress('首次转写需下载本地模型，音频不会上传给转写服务…')
      signal?.throwIfAborted()
      const text=await new Promise<string>((resolve,reject)=>{
        const worker=new Worker(new URL('./asr.worker.ts',import.meta.url),{type:'module'}),timer=setTimeout(()=>{finish();reject(Error('本地转写超时，请稍后重试。'))},300000)
        const abort=()=>{finish();reject(new DOMException('已停止媒体处理','AbortError'))}
        const finish=()=>{clearTimeout(timer);worker.terminate();signal?.removeEventListener('abort',abort)}
        signal?.addEventListener('abort',abort,{once:true})
        worker.onmessage=({data})=>{if(data.progress)onProgress(data.progress);else{finish();data.error?reject(Error(data.error)):resolve(data.text)}}
        worker.onerror=()=>{finish();reject(Error('本地语音引擎启动失败，请使用文字输入。'))};worker.postMessage({audio:rendered.getChannelData(0)})
      })
      if(!text.trim())throw Error('未识别到语音，请重新录制或输入文字。')
      return {media:{kind:'audio',name:file.name,images:[],note:'本机 Whisper 转写，用户确认后将转写文本交给 DeepSeek。'},transcript:text}
    }
    throw Error('请选择照片、音频或视频文件。')
  }finally{URL.revokeObjectURL(url)}
}
