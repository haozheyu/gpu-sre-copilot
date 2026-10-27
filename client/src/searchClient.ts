// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import type {Hit,Knowledge} from './types'
const worker=new Worker(new URL('./search.worker.ts',import.meta.url),{type:'module'})
let seq=0;const pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>()
worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result)}
worker.onerror=()=>{for(const p of pending.values())p.reject(Error('检索进程异常，请重新打开应用。'));pending.clear()}
function call(type:string,data:object){return new Promise<any>((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});worker.postMessage({id,type,...data})})}
export const initIndex=(records:Knowledge[])=>call('init',{records})
export const search=(query:string):Promise<Hit[]>=>call('search',{query})
