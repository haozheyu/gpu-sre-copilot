// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
const {app,BrowserWindow,ipcMain,safeStorage,protocol,net,shell}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
app.setName('gpu-sre-client');
protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
let active;
app.whenReady().then(()=>{
  const root=path.resolve(__dirname,'../dist'),keyFile=path.join(app.getPath('userData'),'deepseek.credential');
  protocol.handle('app',req=>{const url=new URL(req.url);if(url.host!=='local')return new Response('',{status:403});let file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))return new Response('',{status:403});return net.fetch(pathToFileURL(file).toString())});
  const isLocal=url=>{const u=new URL(url);return u.protocol==='app:'&&u.host==='local'};
  const trusted=e=>{if(!e.senderFrame||!isLocal(e.senderFrame.url))throw Error('不受信任的页面')};
  ipcMain.handle('key:get',e=>{trusted(e);return fs.existsSync(keyFile)&&safeStorage.isEncryptionAvailable()?safeStorage.decryptString(fs.readFileSync(keyFile)):''});
  ipcMain.handle('key:set',(e,key)=>{trusted(e);if(typeof key!=='string'||key.length>300||!key.startsWith('sk-'))throw Error('密钥格式错误');if(!safeStorage.isEncryptionAvailable())throw Error('系统安全存储不可用');fs.writeFileSync(keyFile,safeStorage.encryptString(key))});
  ipcMain.handle('key:clear',e=>{trusted(e);if(fs.existsSync(keyFile))fs.unlinkSync(keyFile)});
  ipcMain.handle('chat:cancel',e=>{trusted(e);active?.abort()});
  ipcMain.handle('chat',async(e,key,body)=>{
    trusted(e);if(typeof key!=='string'||!body||body.model!=='deepseek-flash'||JSON.stringify(body).length>16*1024*1024)throw Error('请求参数无效');if(active)throw Error('已有请求正在进行');
    active=new AbortController();const timer=setTimeout(()=>active?.abort(),90000);
    try{const r=await net.fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(body),signal:active.signal});return {status:r.status,data:r.ok?await r.json():null}}
    catch{return {status:504,data:null}}finally{clearTimeout(timer);active=null}
  });
  const win=new BrowserWindow({width:1320,height:920,minWidth:360,minHeight:640,title:'GPU SRE 智能运维平台',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(({url})=>{if(url==="https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzIyMDE3MzE2Mw==&action=getalbum&album_id=4642974900092256256#wechat_redirect")shell.openExternal(url).catch(()=>{});return {action:'deny'}});win.webContents.on('will-navigate',(e,url)=>{if(!isLocal(url))e.preventDefault()});
  win.loadURL('app://local/');
});
app.on('window-all-closed',()=>app.quit());
