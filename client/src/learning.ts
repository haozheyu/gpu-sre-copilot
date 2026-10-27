// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import type {Knowledge} from './types'
export function redact(s:string){return s.replace(/\bsk-[a-z0-9_-]{12,}\b/gi,'[密钥已隐藏]').replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[IP已隐藏]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已隐藏]')}
export async function learnedRecord(title:string,body:string):Promise<Knowledge>{
  title=redact(title);body=redact(body)
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(title.toLowerCase().replace(/\s/g,'')+'\n'+body.replace(/\s/g,'')))
  const fingerprint=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')
  return {id:'learned:'+fingerprint,title,body,kind:'learned',source:'DeepSeek 自动提炼 · 待人工复核',verified:false,updatedAt:new Date().toISOString(),fingerprint}
}
