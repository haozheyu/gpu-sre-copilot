// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs'
import path from 'node:path'
import {chromium} from '@playwright/test'
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'evidence');fs.mkdirSync(out,{recursive:true})
const channel=process.env.BROWSER_CHANNEL||'chrome'
const browser=await chromium.launch(channel==='chromium'?{headless:true}:{channel,headless:true})
const context=await browser.newContext({viewport:{width:1366,height:900},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']})
const page=await context.newPage();page.setDefaultTimeout(30000)
const result={checks:[],errors:[],provider:'mock',physicalDeviceTest:false}
page.on('pageerror',e=>result.errors.push(e.message))
const expected='https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzIyMDE3MzE2Mw==&action=getalbum&album_id=4642974900092256256#wechat_redirect'
try{
 if(fs.existsSync(path.join(root,'client/dist/articles')))throw Error('Private articles still in build')
 await page.goto(process.env.APP_URL||'http://127.0.0.1:5191');await page.locator('.sidebar-bottom').filter({hasText:'本地知识已就绪'}).waitFor()
 await page.locator('.suggestions button').first().click();await page.getByRole('button',{name:'开始分析'}).click();await page.getByText('本地知识命中',{exact:true}).waitFor();result.checks.push('local demo answer without key')
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'导出排版文档 ↓'}).click();await (await event).saveAs(path.join(out,'public-answer.html'));result.checks.push('formatted answer export preserved')
 await page.getByRole('button',{name:'专栏',exact:true}).click();const link=page.getByRole('link',{name:'打开公众号专栏 ↗'});if(await link.getAttribute('href')!==expected)throw Error('Wrong column entry')
 if(await page.getByRole('button',{name:/完整素材包|配图 ↓|Markdown ↓/}).count())throw Error('Article download remains')
 await page.getByRole('button',{name:'复制公众号入口'}).click();await page.getByText('公众号入口已复制，可以粘贴到微信打开。').waitFor();if(await page.evaluate(()=>navigator.clipboard.readText())!==expected)throw Error('Wrong clipboard URL')
 result.checks.push('exact WeChat entry and clipboard; article downloads removed')
 for(const width of [320,375,768,1366]){await page.setViewportSize({width,height:900});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow '+width)}
 result.checks.push('column entry fits mobile and desktop viewports')
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await context.setOffline(true);await page.reload();await page.locator('.sidebar-bottom').filter({hasText:'本地知识已就绪'}).waitFor();await page.locator('.suggestions button').first().click();await page.getByRole('button',{name:'开始分析'}).click();await page.getByText('本地知识命中',{exact:true}).waitFor();result.checks.push('offline local answer still works')
 if(result.errors.length)throw Error(result.errors.join('\n'));result.result='PASS'
}catch(e){result.result='FAIL';result.failure=String(e);throw e}finally{fs.writeFileSync(path.join(out,'public-ui-check.json'),JSON.stringify(result,null,2));await browser.close()}
console.log(JSON.stringify(result,null,2))
