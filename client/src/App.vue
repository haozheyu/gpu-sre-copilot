<!-- Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {ref,computed,onMounted,watch,shallowRef} from 'vue'
import Answer from './Answer.vue'
import {COLUMN_URL} from './column'
import './markdown.css'
import {formattedDocument} from './markdown'
import {nativeAndroid,nativeVault} from './nativeVault'
import type {Knowledge,Turn,Hit,Media} from './types'
import {allKnowledge,putKnowledge,saveTurn,turns,setting,setSetting,validateImport,deleteKnowledge} from './storage'
import {initIndex,search} from './searchClient'
import {canAnswerLocally} from './search'
import {askDeepSeek,MODEL} from './deepseek'
import {learnedRecord} from './learning'
import {seal,unseal,type Vault} from './vault'
import {prepareMedia} from './media'
import {saveFile} from './export'

type Tab='ask'|'knowledge'|'history'|'articles'|'settings'
const tab=ref<Tab>('ask'),nav:{id:Tab;name:string;symbol:string}[]=[{id:'ask',name:'问诊',symbol:'◉'},{id:'knowledge',name:'知识库',symbol:'▤'},{id:'history',name:'记录',symbol:'◷'},{id:'articles',name:'专栏',symbol:'↗'},{id:'settings',name:'设置',symbol:'⚙'}]
const records=shallowRef<Knowledge[]>([]),history=ref<Turn[]>([]),ready=ref(false),boot=ref('正在读取本地知识…'),notice=ref(''),error=ref(''),busy=ref(false),phase=ref(''),question=ref(''),key=ref(''),keyInput=ref(''),password=ref(''),hasVault=ref(false),settingsBusy=ref(false)
const current=ref<Turn|null>(null),hits=ref<Hit[]>([]),media=ref<Media>(),preparing=ref(false),filter=ref(''),pendingOnly=ref(false),kbHits=ref<Hit[]>([]),selected=ref<Knowledge|null>(null),sessionOnly=ref(false)
let controller:AbortController|undefined,mediaController:AbortController|undefined,filterRevision=0
const learnedCount=computed(()=>records.value.filter(r=>r.kind==='learned').length)
const pendingCount=computed(()=>records.value.filter(r=>!r.verified).length)
const displayed=computed(()=>{const list=filter.value?kbHits.value.map(h=>h.record):records.value;return list.filter(r=>!pendingOnly.value||!r.verified).slice(0,40)})
const examples=computed(()=>records.value.filter(r=>r.kind==='qa'&&r.title.length<90).slice(0,3))
const desktop=Boolean(window.desktop)


function fail(e:unknown){error.value=e instanceof Error?e.message:'操作失败，请重试。'}
function download(name:string,value:string,type='application/json'){saveFile(name,value,type).catch(fail)}
async function copyColumn(){try{await navigator.clipboard.writeText(COLUMN_URL);notice.value='公众号入口已复制，可以粘贴到微信打开。'}catch{error.value='复制失败，请使用下方链接打开公众号。'}}
async function refresh(){records.value=await allKnowledge();await initIndex(records.value);history.value=await turns()}
onMounted(async()=>{
 try{
   records.value=await allKnowledge()
   if(!records.value.length){boot.value='首次初始化：导入随附知识包…';const r=await fetch('./knowledge.json');if(!r.ok)throw Error('尚未找到知识包，请在知识库页导入导出的 JSON 文件。');await putKnowledge(await validateImport(await r.json()));records.value=await allKnowledge()}
   boot.value='建立本机检索索引…';await initIndex(records.value);history.value=await turns();ready.value=true;boot.value=''
   hasVault.value=Boolean(await setting('vault'));if(window.desktop)key.value=await window.desktop.getKey();else if(nativeAndroid)key.value=(await nativeVault.get()).key
   navigator.storage?.persist?.().catch(()=>{})
 }catch(e){fail(e);boot.value='';tab.value='knowledge'}
})
watch(filter,async()=>{const rev=++filterRevision;if(!filter.value.trim()){kbHits.value=[];return}try{const result=await search(filter.value);if(rev===filterRevision)kbHits.value=result}catch(e){fail(e)}})
async function send(){
 if(busy.value||preparing.value||!ready.value||!question.value.trim())return
 busy.value=true;error.value='';notice.value='';current.value=null;controller=new AbortController();const q=question.value.trim(),attachment=media.value;let timeout:ReturnType<typeof setTimeout>|undefined
 try{
   phase.value='检索本地知识…';hits.value=await search(q)
   let turn:Turn,summary:{title:string;body:string}|null=null
   if(!attachment&&canAnswerLocally(q,hits.value)){
     const h=hits.value[0];turn={id:crypto.randomUUID(),question:q,answer:h.record.body,route:'local',sources:[h.record.source],createdAt:new Date().toISOString(),learning:'已存在于本地知识库，未重复收录'}
   }else{
     phase.value='DeepSeek 正在分析…';timeout=setTimeout(()=>{controller?.abort();window.desktop?.cancel()},95000)
     const result=await askDeepSeek(key.value,q,hits.value,attachment,controller.signal);if(controller.signal.aborted)throw new DOMException('已取消','AbortError')
     summary=result.knowledge;turn={id:crypto.randomUUID(),question:q,answer:result.answer,route:'deepseek',sources:hits.value.slice(0,3).map(h=>h.record.source),createdAt:new Date().toISOString(),learning:'未提取到可复用知识'}
   }
   if(controller.signal.aborted)throw new DOMException('已取消','AbortError')
   current.value=turn
   // Persist completed answer before optional learning; a learning failure never discards it.
   await saveTurn(turn)
   if(summary){try{phase.value='提炼并保存知识…';const learned=await learnedRecord(summary.title,summary.body),old=records.value.find(r=>r.id===learned.id);if(!old)await putKnowledge([learned]);turn.learning=old?'相同知识已收录，本次未重复写入':'已自动提炼入库 · 待复核';await saveTurn(turn);await refresh()}catch{turn.learning='答案已保存，知识沉淀失败；可从记录导出答案。';notice.value=turn.learning}}
   history.value=await turns();current.value={...turn}
 }catch(e){if(e instanceof DOMException&&e.name==='AbortError')error.value='已停止等待或请求超时，未完成回答不会入库；模型端可能仍在处理。';else fail(e)}
 finally{clearTimeout(timeout);busy.value=false;phase.value='';controller=undefined}
}
function cancel(){controller?.abort();window.desktop?.cancel();notice.value='正在停止请求…'}
async function importFile(event:Event){
 const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;error.value='';boot.value='校验并导入知识包…';ready.value=false
 try{if(file.size>80*1024*1024)throw Error('知识包超过 80 MB，请拆分后导入。');const rows=await validateImport(JSON.parse(await file.text()));await putKnowledge(rows);await refresh();ready.value=true;notice.value=`已导入 ${rows.length.toLocaleString()} 条知识，按 ID 合并。`}
 catch(e){fail(e);try{await refresh();ready.value=true}catch{}}
 finally{boot.value='';input.value=''}
}
async function attach(event:Event){
 const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;error.value='';notice.value='';preparing.value=true;media.value=undefined;mediaController=new AbortController()
 try{const result=await prepareMedia(file,s=>phase.value=s,mediaController.signal);mediaController.signal.throwIfAborted();media.value=result.media;if(result.transcript)question.value=(question.value?question.value+'\n\n':'')+result.transcript;notice.value=result.transcript?'语音已在本机转写，请检查文字后点击发送。':'媒体已准备好，发送时交给 DeepSeek 分析。'}catch(e){fail(e)}finally{preparing.value=false;phase.value='';input.value='';mediaController=undefined}
}
async function saveKey(){settingsBusy.value=true;error.value='';try{
 const k=keyInput.value.trim();if(!/^sk-[\w-]{12,}$/.test(k))throw Error('请输入完整的 DeepSeek API 密钥。')
 if(sessionOnly.value){key.value=k;notice.value='密钥仅在本次打开期间使用。'}
 else if(window.desktop){await window.desktop.setKey(k);key.value=k;notice.value='密钥已保存至 Windows 加密存储。'}
 else if(nativeAndroid){await nativeVault.set({key:k});key.value=k;notice.value='密钥已保存至 Android 系统加密存储。'}
 else {if(!crypto.subtle)throw Error('加密存储需要 HTTPS 或本机 localhost 环境。');await setSetting('vault',await seal(k,password.value));hasVault.value=true;key.value=k;notice.value='密钥已用口令加密保存在本机。'}
 keyInput.value='';password.value=''
 }catch(e){fail(e)}finally{settingsBusy.value=false}}
async function unlock(){settingsBusy.value=true;error.value='';try{const v=await setting<Vault>('vault');if(!v)throw Error('尚未保存密钥。');key.value=await unseal(v,password.value);password.value='';notice.value='密钥已解锁。'}catch(e){fail(e)}finally{settingsBusy.value=false}}
async function forget(){try{await window.desktop?.clearKey();if(nativeAndroid)await nativeVault.clear();await setSetting('vault',null);key.value='';hasVault.value=false;notice.value='已移除本机保存的密钥。'}catch(e){fail(e)}}
async function review(r:Knowledge){try{const updated={...r,verified:true,source:r.source.replace('待人工复核','用户已复核'),updatedAt:new Date().toISOString()};await putKnowledge([updated]);await refresh();selected.value=updated;notice.value='已标记为复核通过。'}catch(e){fail(e)}}
async function remove(r:Knowledge){try{await deleteKnowledge(r.id);selected.value=null;await refresh();notice.value='已移除该知识条目。'}catch(e){fail(e)}}
function exportDocument(t:Turn){download('GPU-SRE-诊断记录.html',formattedDocument(t.question,t.answer,[`来源路径：${t.route==='local'?'本地知识':'DeepSeek'}`, ...t.sources,t.learning||'']),'text/html;charset=utf-8')}
function exportAnswer(t:Turn){download('GPU-SRE-诊断记录.md',`# ${t.question}\n\n${t.answer}\n\n---\n来源路径：${t.route}\n\n${t.sources.join('\n\n')}\n\n${t.learning||''}\n`,'text/markdown;charset=utf-8')}
function openTurn(t:Turn){current.value=t;question.value=t.question;media.value=undefined;hits.value=[];tab.value='ask'}
</script>

<template>
 <div class="workspace">
  <aside class="sidebar">
   <a class="brand" href="#" @click.prevent="tab='ask'"><img src="/icon.svg" width="36" height="36" alt=""><span>GPU SRE<small>智能运维平台</small></span></a>
   <div class="rail-label">个人工作台 / LOCAL FIRST</div>
   <nav aria-label="主导航"><button v-for="item in nav" :key="item.id" :class="{active:tab===item.id}" :aria-current="tab===item.id?'page':undefined" @click="tab=item.id"><span aria-hidden="true">{{item.symbol}}</span>{{item.name}}<small v-if="item.id==='knowledge'">{{records.length.toLocaleString()}}</small></button></nav>
   <div class="sidebar-bottom"><span class="status-dot"></span>{{ready?'本地知识已就绪':'本地初始化中'}}<p>数据留在设备<br>需要时连接 DeepSeek</p><span class="version">CLIENT / 0.1.1</span></div>
  </aside>
  <main>
   <header class="topbar"><span class="breadcrumb">GPU SRE <span>/</span> {{nav.find(n=>n.id===tab)?.name}}</span><button class="connection" @click="tab='settings'">{{key?'DeepSeek 已配置':'配置 DeepSeek'}} <span aria-hidden="true">↗</span></button></header>
   <div class="feedback" aria-live="polite"><p v-if="boot">{{boot}}</p><p v-if="notice" class="notice">{{notice}}</p><p v-if="error" class="error" role="alert">{{error}}</p></div>
   <div class="page">
    <section v-if="tab==='ask'" class="diagnosis">
     <div class="heading"><div><p class="eyebrow">诊断，从证据开始</p><h1>今天，集群遇到了什么？</h1><p class="muted">先查本地知识，再请 DeepSeek 帮你分析。</p></div><span class="edition">个人版<br>手机 / PC</span></div>
     <div class="diagnosis-grid"><div>
      <form class="composer" @submit.prevent="send">
       <label for="question">描述故障或提出问题</label>
       <textarea id="question" v-model="question" maxlength="12000" :disabled="busy||preparing" placeholder="例如：GPU 温度持续升高，怎样区分功率限制与温度降频？" rows="6"></textarea>
       <div v-if="media" class="attachment"><strong>{{media.name}}</strong><p>{{media.note}}</p><div class="thumbnails"><img v-for="(img,i) in media.images" :key="i" :src="img" :alt="`采样图片 ${i+1}`"></div><button type="button" :disabled="busy" @click="media=undefined">移除附件</button></div>
       <div class="composer-tools"><label class="file-button" :class="{disabled:busy||preparing}" tabindex="0" @keydown.enter="($refs.mediaInput as HTMLInputElement).click()">＋ 添加媒体<input ref="mediaInput" type="file" accept="image/*,audio/*,video/*" :disabled="busy||preparing" @change="attach"></label><span class="input-hint">照片 · 语音 · 视频</span><button v-if="busy" type="button" @click="cancel">停止</button><button v-else class="primary" :disabled="!ready||preparing||!question.trim()" type="submit">{{preparing?'处理中…':'开始分析'}} <span v-if="!preparing">↑</span></button></div>
       <p v-if="phase" class="progress" role="status">{{phase}} <button v-if="preparing" type="button" @click="mediaController?.abort()">停止处理</button></p>
      </form>
      <p class="privacy-note">发送媒体会将压缩图片、采样帧或转写文字交给 DeepSeek；原始音频与视频留在本机。</p>
      <section v-if="current" class="result">
       <div class="result-head"><span class="source-badge">{{current.route==='local'?'本地知识命中':'DeepSeek 分析'}}</span><div class="actions"><button @click="exportDocument(current)">导出排版文档 ↓</button><button @click="exportAnswer(current)">Markdown 源文 ↓</button></div></div>
       <h2>{{current.question}}</h2><Answer :text="current.answer"/>
       <details v-if="current.sources.length"><summary>{{current.route==='local'?'知识来源':'发送给模型的参考资料'}} · {{current.sources.length}} 条</summary><p v-for="s in current.sources" :key="s">{{s}}</p></details>
       <p class="learning-note">{{current.learning}}</p>
      </section>
      <section v-else class="suggestions"><h2>从知识库试问一个问题</h2><p v-if="!ready" class="muted">知识包导入后，会显示可直接回答的问题。</p><button v-for="(example,i) in examples" :key="example.id" :disabled="busy||preparing" @click="question=example.title;media=undefined"><span class="suggestion-number">0{{i+1}}</span><span class="suggestion-text">{{example.title}}</span><span aria-hidden="true">↗</span></button></section>
     </div><aside class="context-panel"><p class="eyebrow">这次回答会经过</p><ol class="flow"><li><span>01</span><div><strong>检索本地知识</strong><p>{{records.length.toLocaleString()}} 条记录可在设备上查阅</p></div></li><li><span>02</span><div><strong>按需调用模型</strong><p>本地不足或携带媒体时，交给 DeepSeek</p></div></li><li><span>03</span><div><strong>积累可复用知识</strong><p>答案自动提炼，保留来源与复核状态</p></div></li></ol><div class="note-block"><strong>建议有依据，执行需判断</strong><p>当前版本提供诊断建议，不连接集群执行操作。请结合实际环境复核命令。</p></div><div class="small-stats"><div><strong>{{learnedCount}}</strong><span>已沉淀问答</span></div><div><strong>{{pendingCount}}</strong><span>待复核知识</span></div></div></aside></div>
    </section>

    <section v-else-if="tab==='knowledge'">
     <div class="heading"><div><p class="eyebrow">随身知识库</p><h1>把经验留在本机</h1><p class="muted">{{records.length.toLocaleString()}} 条记录 · 支持离线检索与跨设备迁移</p></div><div class="actions"><label class="file-button" tabindex="0" @keydown.enter="($refs.importInput as HTMLInputElement).click()">导入知识包<input ref="importInput" type="file" accept=".json" @change="importFile"></label><button :disabled="!ready" @click="download('gpu-sre-knowledge.json',JSON.stringify({schema:1,records}))">导出 ↓</button></div></div>
     <div class="search-row"><div><label for="kb-search">搜索知识</label><input id="kb-search" v-model="filter" :disabled="!ready" placeholder="GPU、RDMA、降频、故障现象…"></div><label class="check"><input type="checkbox" v-model="pendingOnly">仅待复核</label></div>
     <p class="muted">已复核条目可以参与本地直答；自动提炼内容需要你阅读后复核。导入包会按 ID 合并，请只导入自己信任的文件。</p>
     <div class="knowledge-layout"><div class="knowledge-list"><button v-for="r in displayed" :key="r.id" :class="{selected:selected?.id===r.id}" @click="selected=r"><small>{{r.verified?'已复核':'待复核'}} · {{r.kind==='learned'?'问答沉淀':'已有知识'}}</small><span>{{r.title}}</span></button><p v-if="!displayed.length">没有匹配记录。试试更短的关键词，或导入知识包。</p><p class="muted">当前展示 {{displayed.length}} 条，搜索可缩小范围。</p></div><article v-if="selected" class="knowledge-detail"><div class="actions"><button v-if="!selected.verified" @click="review(selected)">我已复核</button><button v-if="selected.kind==='learned'" @click="remove(selected)">移除此条</button><button @click="question=selected.title;media=undefined;tab='ask'">带入问诊 ↗</button></div><h2>{{selected.title}}</h2><p class="muted">{{selected.source}}</p><Answer :text="selected.body"/></article><div v-else class="empty-panel">选择一条知识，查看原文和来源。</div></div>
    </section>

    <section v-else-if="tab==='history'"><div class="heading"><div><p class="eyebrow">诊断记录</p><h1>每次排查，都有迹可循</h1><p class="muted">已完成的问答保存在当前设备，不含密钥和原始媒体。</p></div></div><div class="history-list"><article v-for="t in history" :key="t.id"><small>{{new Date(t.createdAt).toLocaleString()}} · {{t.route==='local'?'本地知识':'DeepSeek'}}</small><h2>{{t.question}}</h2><div class="history-preview"><Answer :text="t.answer"/></div><div class="actions"><button @click="openTurn(t)">查看记录</button><button @click="exportDocument(t)">导出排版文档 ↓</button><button @click="exportAnswer(t)">Markdown 源文 ↓</button></div></article><div v-if="!history.length" class="empty-panel">完成一次问诊后，记录会出现在这里。<button @click="tab='ask'">开始问诊 ↗</button></div></div></section>

    <section v-else-if="tab==='articles'" class="column-entry"><div class="heading"><div><p class="eyebrow">GPU SRE 项目实战 · 公众号</p><h1>项目讲解，请到公众号阅读</h1><p class="muted">各阶段实现思路、代码讲解与图文教程在公众号专栏持续整理。</p></div></div><div class="actions"><a class="column-link" :href="COLUMN_URL" target="_blank" rel="noopener noreferrer">打开公众号专栏 ↗</a><button @click="copyColumn">复制公众号入口</button></div><p class="muted">也可以复制入口后粘贴到微信阅读。公开客户端不附带文章正文、配图或素材包。</p></section>

    <section v-else class="settings"><div class="heading"><div><p class="eyebrow">仅作用于当前设备</p><h1>模型与本机存储</h1><p class="muted">DeepSeek 密钥由你自己持有，应用不经过业务服务端。</p></div></div>
     <form @submit.prevent="saveKey" class="settings-form"><h2>DeepSeek 连接</h2><p>模型：<code>{{MODEL}}</code> · {{key?'已解锁，可以发起请求':'尚未解锁'}}</p><label for="key">API 密钥</label><input id="key" v-model="keyInput" type="password" autocomplete="off" placeholder="sk-…"><label class="check"><input v-model="sessionOnly" type="checkbox">仅本次使用，不保存新密钥</label><template v-if="!desktop&&!nativeAndroid&&!sessionOnly"><label for="password">本机解锁口令（至少 8 位）</label><input id="password" v-model="password" type="password" autocomplete="off"><p class="muted">密钥采用口令加密保存。忘记口令后，需要重新输入 API 密钥。应用不会把密钥打包进安装文件。</p></template><p v-if="nativeAndroid" class="muted">私人版首次启动自动配置；密钥保存在 Android 系统加密存储。移除后不会自动恢复，重新配置可替换密钥。</p><p v-if="desktop" class="muted">PC 客户端使用 Windows 系统加密存储保存密钥。</p><div class="actions"><button class="primary" :disabled="settingsBusy">{{settingsBusy?'处理中…':'保存配置'}}</button><button v-if="hasVault&&!desktop&&!nativeAndroid" type="button" :disabled="settingsBusy" @click="unlock">解锁</button><button v-if="key" type="button" @click="key='';notice='已锁定本次会话。'">锁定</button><button type="button" :disabled="settingsBusy" @click="forget">移除密钥</button></div></form>
     <section class="settings-form"><h2>双端使用</h2><p>PC 与手机各自保存知识与问答。通过知识库页“导出 / 导入”迁移，无自动云同步。</p><p>手机浏览器版需 HTTPS 静态入口，可添加到主屏幕；微信内打开时，建议转到系统浏览器。原生 Android 工程与 PC 客户端均直接连接 DeepSeek。</p><p>语音首次使用会下载 Whisper 模型，转写在本机运行。视频仅发送 5 张采样帧，不包含声音。</p></section>
    </section>
   </div><footer>GPU SRE Copilot <span>本地知识 · 按需推理 · 经验沉淀</span></footer>
  </main>
 </div>
</template>
