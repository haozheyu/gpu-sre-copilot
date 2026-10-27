// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import { SearchIndex } from './search'
let index:SearchIndex
self.onmessage=(e)=>{const {id,type,records,query}=e.data;try{if(type==='init'){index=new SearchIndex(records);self.postMessage({id,result:true})}else self.postMessage({id,result:index.search(query,8)})}catch{self.postMessage({id,error:'本地检索失败，请重新导入知识包。'})}}
