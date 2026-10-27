// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import { openDB } from 'idb'
import type { Knowledge, Turn } from './types'
const db=openDB('gpu-sre-local',1,{upgrade(d){d.createObjectStore('knowledge',{keyPath:'id'});d.createObjectStore('turns',{keyPath:'id'});d.createObjectStore('settings')}})
export async function allKnowledge():Promise<Knowledge[]>{return (await db).getAll('knowledge')}
export async function putKnowledge(rows:Knowledge[]){const tx=(await db).transaction('knowledge','readwrite');for(const r of rows)tx.store.put(r);await tx.done}
export async function deleteKnowledge(id:string){await(await db).delete('knowledge',id)}
export async function saveTurn(t:Turn){await(await db).put('turns',t)}
export async function turns():Promise<Turn[]>{return (await(await db).getAll('turns')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
export async function setting<T>(key:string):Promise<T|undefined>{return(await db).get('settings',key)}
export async function setSetting(key:string,value:unknown){await(await db).put('settings',value,key)}
export async function validateImport(raw:unknown):Promise<Knowledge[]>{
  const obj=raw as {schema?:number;records?:unknown[]};if(obj?.schema!==1||!Array.isArray(obj.records)||obj.records.length>50000)throw Error('知识包格式不正确，需要 schema=1 的 JSON 文件（最多 5 万条）。')
  const seen=new Set<string>()
  return obj.records.map((v:any)=>{
    if(!v||typeof v.id!=='string'||!v.id||v.id.length>200||typeof v.title!=='string'||!v.title.trim()||v.title.length>4000||typeof v.body!=='string'||v.body.length>200000||typeof v.source!=='string'||typeof v.verified!=='boolean'||!['qa','document','learned'].includes(v.kind)||typeof v.updatedAt!=='string'||seen.has(v.id))throw Error('知识包包含无效或重复条目，未写入任何数据。')
    seen.add(v.id);return {id:v.id,title:v.title,body:v.body,source:v.source,verified:v.verified,kind:v.kind,updatedAt:v.updatedAt} as Knowledge
  })
}
