// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
export default defineConfig({base:'./',server:{watch:{ignored:['**/android/**','**/release/**','**/dist/**']}},optimizeDeps:{include:['@huggingface/transformers','@capacitor/filesystem','@capacitor/share']},plugins:[vue(),{name:'offline-shell',closeBundle(){
  const walk=(p:string):string[]=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):[`${p}/${e.name}`]);
  const files=walk('dist').filter(p=>!p.endsWith('sw.js')&&!p.endsWith('knowledge.json')).map(p=>'./'+p.slice(5));
  const version=Date.now();
  fs.writeFileSync('dist/sw.js',`const CACHE='gpu-sre-${version}';self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(${JSON.stringify(files)}))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('gpu-sre-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;const key=e.request.mode==='navigate'?new URL('./index.html',self.registration.scope).href:e.request;e.respondWith(caches.match(key,{ignoreVary:true}).then(r=>r||fetch(e.request)));});`);
}}],worker:{format:'es'},build:{target:'es2022'}})
