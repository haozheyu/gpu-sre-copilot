// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
const enc=new TextEncoder(),dec=new TextDecoder()
async function derive(password:string,salt:Uint8Array){
  if(password.length<8)throw Error('解锁口令至少需要 8 个字符。')
  const base=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey'])
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])
}
export interface Vault {salt:number[];iv:number[];data:number[]}
export async function seal(key:string,password:string):Promise<Vault>{
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12))
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await derive(password,salt),enc.encode(key))
  return {salt:[...salt],iv:[...iv],data:[...new Uint8Array(data)]}
}
export async function unseal(v:Vault,password:string){try{return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(v.iv)},await derive(password,new Uint8Array(v.salt)),new Uint8Array(v.data)))}catch{throw Error('解锁失败，请检查口令。')}}
