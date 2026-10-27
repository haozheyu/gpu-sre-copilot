// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from 'vitest'
import 'fake-indexeddb/auto'
import {SearchIndex,canAnswerLocally} from './search'
import {validateImport,putKnowledge,allKnowledge} from './storage'
import {seal,unseal} from './vault'
import {makeRequest,decodeAnswer,apiError,abortable,askDeepSeek} from './deepseek'
import {learnedRecord} from './learning'
import type {Knowledge} from './types'
const record:Knowledge={id:'test:1',title:'GPU 温度过高如何排查',body:'首先检查进风温度、风扇转速和散热器。记录 nvidia-smi 的温度与频率。',source:'SOP 1',verified:true,kind:'qa',updatedAt:'2026-10-27'}
describe('local routing boundaries',()=>{
 it('answers exact known question locally',()=>{const i=new SearchIndex([record]);expect(canAnswerLocally(record.title,i.search(record.title))).toBe(true)})
 it('does not mistake shared GPU word for knowledge coverage',()=>{const q='GPU NVLink 交换机固件版本不兼容怎么处理';expect(canAnswerLocally(q,new SearchIndex([record]).search(q))).toBe(false)})
 it('never directly answers unreviewed learned content',()=>{expect(canAnswerLocally(record.title,new SearchIndex([{...record,verified:false}]).search(record.title))).toBe(false)})
 it('returns empty for nonsense and punctuation',()=>{const i=new SearchIndex([record]);expect(i.search('qzxv91919')).toEqual([]);expect(i.search('？？')).toEqual([])})
 it('finds Chinese substrings and case-insensitive technical terms',()=>{expect(new SearchIndex([record]).search('gpu 温度')[0].record.id).toBe(record.id)})
})
describe('knowledge persistence',()=>{
 it('validates all rows before writing and rejects duplicates',async()=>{await expect(validateImport({schema:1,records:[record,record]})).rejects.toThrow();await expect(validateImport({schema:1,records:[record,{id:'bad'}]})).rejects.toThrow()})
 it('upserts without duplicates',async()=>{await putKnowledge(await validateImport({schema:1,records:[record]}));await putKnowledge([record]);expect((await allKnowledge()).filter(r=>r.id===record.id)).toHaveLength(1)})
 it('rejects unsupported schema and oversized fields',async()=>{await expect(validateImport({schema:2,records:[]})).rejects.toThrow();await expect(validateImport({schema:1,records:[{...record,title:'x'.repeat(4001)}]})).rejects.toThrow()})
})
describe('credential encryption',()=>{
 it('round trips but never persists plaintext; wrong password fails',async()=>{const v=await seal('sk-test-secret-only','testing-password');expect(JSON.stringify(v)).not.toContain('sk-test');expect(await unseal(v,'testing-password')).toBe('sk-test-secret-only');await expect(unseal(v,'wrong-password')).rejects.toThrow()})
 it('rejects short passwords and detects tampering',async()=>{await expect(seal('x','123')).rejects.toThrow();const v=await seal('secret','long-password');v.data[0]^=1;await expect(unseal(v,'long-password')).rejects.toThrow()})
})
describe('DeepSeek contract',()=>{
 it('stops native waiting and ignores late response',async()=>{const c=new AbortController();let complete!:(v:string)=>void;const result=abortable(new Promise<string>(r=>complete=r),c.signal);c.abort();await expect(result).rejects.toMatchObject({name:'AbortError'});complete('late')})
 it('does not start a pre-aborted model request',async()=>{const c=new AbortController();c.abort();await expect(askDeepSeek('sk-test','q',[],undefined,c.signal)).rejects.toMatchObject({name:'AbortError'})})
 it('sends images as real image parts',()=>{const r=makeRequest('分析照片',[],{kind:'image',name:'a',images:['data:image/jpeg;base64,eA=='],note:'photo'});expect((r.messages[1].content as any[])[1].type).toBe('image_url')})
 it('labels unreviewed references instead of upgrading them to facts',()=>{const r=makeRequest('q',[{record:{...record,verified:false},score:1,coverage:1,exact:true}]);expect(r.messages[1].content).toContain('AI生成待复核')})
 it('rejects malformed/truncated/empty responses',()=>{for(const msg of [{choices:[]},{choices:[{message:{content:'wrong'}}]},{choices:[{finish_reason:'length',message:{content:'{}'}}]}])expect(()=>decodeAnswer(msg)).toThrow()})
 it('accepts valid response and optional summary',()=>{expect(decodeAnswer({choices:[{message:{content:JSON.stringify({answer:'检查温度',knowledge:null})}}]})).toEqual({answer:'检查温度',knowledge:null})})
 it('maps key, billing, throttling errors',()=>{expect(apiError(401)).toContain('密钥');expect(apiError(402)).toContain('余额');expect(apiError(429)).toContain('频繁')})
})
describe('automatic learning',()=>{
 it('deduplicates identical summaries and preserves review state',async()=>{const a=await learnedRecord('温度排查','检查机房进风和风扇状态。'),b=await learnedRecord('温度排查','检查机房进风和风扇状态。');expect(a.id).toBe(b.id);expect(a.verified).toBe(false)})
 it('redacts common identifiers before persistence',async()=>{const a=await learnedRecord('server 192.168.1.2','secret sk-abcdefghijklmnop and a@b.com');expect(a.title).not.toContain('192.168.1.2');expect(a.body).not.toContain('sk-');expect(a.body).not.toContain('a@b.com')})
})
