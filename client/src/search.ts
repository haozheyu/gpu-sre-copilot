// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import type { Knowledge, Hit } from './types'
export const normalize=(s:string)=>s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'')
const stops=new Set(['如何','什么','怎么','为什么','一下','请问','问题','这个','一个','进行','可以','需要','是否','哪些','以及','的','了','吗'])
export function terms(s:string):string[]{
  const out:string[]=[]
  for(const part of s.toLowerCase().match(/[a-z0-9][a-z0-9_./-]*|[\u4e00-\u9fff]+/g)||[]){
    if(/^[a-z0-9]/.test(part)){out.push(part);continue}
    for(let i=0;i<part.length-1;i++){const t=part.slice(i,i+2);if(!stops.has(t))out.push(t)}
  }
  return [...new Set(out)]
}
export class SearchIndex {
  records:Knowledge[]; postings=new Map<string,Map<number,number>>(); exact=new Map<string,number[]>();
  constructor(records:Knowledge[]){this.records=records;records.forEach((r,i)=>{
    const n=normalize(r.title);this.exact.set(n,[...(this.exact.get(n)||[]),i]);
    for(const [text,weight] of [[r.title,3],[r.body,1]] as const)for(const t of terms(text)){
      let m=this.postings.get(t);if(!m)this.postings.set(t,m=new Map());m.set(i,(m.get(i)||0)+weight)
    }
  })}
  search(q:string,limit=5):Hit[]{
    const ts=terms(q); if(!ts.length)return []
    const scores=new Map<number,{score:number,matched:number}>();
    for(const t of ts){const p=this.postings.get(t);if(!p)continue;const idf=Math.log(1+this.records.length/(p.size+1));for(const [i,w] of p){const v=scores.get(i)||{score:0,matched:0};v.score+=idf*w;v.matched++;scores.set(i,v)}}
    for(const i of this.exact.get(normalize(q))||[])scores.set(i,{score:1e6,matched:ts.length})
    return [...scores].map(([i,v])=>({record:this.records[i],score:v.score,coverage:v.matched/ts.length,exact:normalize(this.records[i].title)===normalize(q)})).sort((a,b)=>b.score-a.score).slice(0,limit)
  }
}
// Search relevance is not a probability. Only narrow matches bypass the model.
export function canAnswerLocally(q:string,hits:Hit[]):boolean{
  const h=hits[0];if(!h||!h.record.verified)return false
  if(h.exact)return true
  const a=new Set(terms(q)),b=new Set(terms(h.record.title));const shared=[...a].filter(x=>b.has(x)).length
  const jaccard=shared/(a.size+b.size-shared||1)
  return a.size>=3&&h.coverage>=0.9&&jaccard>=0.72
}
