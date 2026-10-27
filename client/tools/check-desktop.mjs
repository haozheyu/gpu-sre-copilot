// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import {_electron as electron} from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
const testProfile=fs.mkdtempSync(path.join(os.tmpdir(),'gpu-sre-desktop-test-'))
const app=await electron.launch(process.env.PACKAGED_SRE_TEST==='1'?{executablePath:path.resolve('release/win-unpacked/GPU SRE Copilot.exe'),args:[`--user-data-dir=${testProfile}`]}:{args:['.',`--user-data-dir=${testProfile}`]});const page=await app.firstWindow();page.setDefaultTimeout(90000)
const result={checks:[],errors:[]};page.on('pageerror',e=>result.errors.push(e.message))
try{
 await page.locator('.sidebar-bottom').filter({hasText:'本地知识已就绪'}).waitFor()
 result.checks.push('packaged app scheme loads knowledge and worker')
 result.credentialAvailable=await page.evaluate(async()=>Boolean(await window.desktop.getKey()))
 await page.locator('.suggestions button').first().click();await page.getByRole('button',{name:'开始分析'}).click();await page.getByText('本地知识命中',{exact:true}).waitFor();result.checks.push('desktop local answer and IndexedDB persistence')
 if(process.env.LIVE_SRE_TEST==='1'){
   await page.getByLabel('描述故障或提出问题').fill('联调验证：请用一句话解释 GPU 热降频，并给出一条只读检查建议。')
   await page.getByRole('button',{name:'开始分析'}).click();await Promise.race([page.getByText('DeepSeek 分析',{exact:true}).waitFor({timeout:110000}),page.locator('.error').waitFor({timeout:110000}).then(async()=>{throw Error(await page.locator('.error').innerText())})]);await page.waitForFunction(()=>!document.querySelector('.progress'));result.checks.push('LIVE: renderer to Electron IPC to DeepSeek; answer persisted and learning completed');result.liveLearning=await page.locator('.learning-note').innerText()
 }
 await page.getByRole('button',{name:'专栏',exact:true}).click();await page.getByRole('link',{name:'打开公众号专栏 ↗'}).waitFor();result.checks.push('WeChat column entry replaces bundled articles')
 await page.screenshot({path:path.resolve('../evidence/desktop-native.png'),fullPage:true});result.result=result.errors.length?'FAIL':'PASS'
}catch(e){result.result='FAIL';result.error=String(e);result.feedback=await page.locator('.feedback').innerText();await page.screenshot({path:path.resolve('../evidence/desktop-failure.png'),fullPage:true});throw e}finally{fs.writeFileSync(process.env.PACKAGED_SRE_TEST==='1'?'../evidence/desktop-packaged-check.json':'../evidence/desktop-check.json',JSON.stringify(result,null,2));await app.close()}
console.log(JSON.stringify(result,null,2))
