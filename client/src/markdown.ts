// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import MarkdownIt from 'markdown-it'
import documentCss from './markdown.css?inline'
// Raw HTML is disabled: answers and imported knowledge are untrusted input.
const md=new MarkdownIt({html:false,breaks:true,linkify:false})
md.validateLink=url=>/^https?:\/\//i.test(url)
md.renderer.rules.link_open=(tokens,index,options,_env,self)=>{
 tokens[index].attrSet('target','_blank');tokens[index].attrSet('rel','noopener noreferrer')
 return self.renderToken(tokens,index,options)
}
// Model-generated images must not silently send tracking requests.
md.renderer.rules.image=(tokens,index)=>`<span class="image-placeholder">[图片：${md.utils.escapeHtml(tokens[index].content||'未命名')}，未自动加载]</span>`
md.renderer.rules.table_open=()=>'<div class="table-scroll" tabindex="0" role="region" aria-label="表格，可左右滑动"><table>\n'
md.renderer.rules.table_close=()=>'</table></div>\n'
export function renderMarkdown(text:string){return md.render(text)}
export function formattedDocument(title:string,body:string,notes:string[]=[]){
 const escape=md.utils.escapeHtml
 return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><style>${documentCss}\nbody{margin:0;padding:24px;background:#fff;color:#1c293e;font-family:system-ui,sans-serif}main{max-width:900px;margin:auto}header h1{font-size:26px;overflow-wrap:anywhere}footer{margin-top:32px;border-top:1px solid #d5deea;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><main><header><h1>${escape(title)}</h1></header><article class="markdown-document">${renderMarkdown(body)}</article><footer>${notes.map(escape).join('\n\n')}</footer></main></body></html>`
}
