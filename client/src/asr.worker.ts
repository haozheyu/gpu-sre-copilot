// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import { pipeline, env } from '@huggingface/transformers'
env.allowLocalModels=false
let transcriber:any
self.onmessage=async(e)=>{try{
  if(!transcriber)transcriber=await pipeline('automatic-speech-recognition','Xenova/whisper-tiny',{dtype:'q8',device:'wasm',progress_callback:(p:any)=>self.postMessage({progress:p.status==='progress'?`下载语音模型 ${Math.round(p.progress||0)}%`:'加载本地语音模型…'})})
  const out=await transcriber(e.data.audio,{language:'chinese',task:'transcribe',chunk_length_s:25,stride_length_s:5})
  self.postMessage({text:out.text})
}catch{self.postMessage({error:'本机语音转写失败。首次使用需要联网下载模型；请检查网络或改用文字输入。'})}}
