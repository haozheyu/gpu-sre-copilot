// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from 'vitest'
import {renderMarkdown,formattedDocument} from './markdown'
describe('document rendering boundary',()=>{
 it('renders structured answers and preserves commands',()=>{
  const html=renderMarkdown('# 排查\n\n**重点**\n\n1. 温度\n2. 显存\n\n| GPU | 温度 |\n| --- | --- |\n| 0 | 85 |\n\n```bash\nnvidia-smi --query-gpu=temperature.gpu\n```')
  for(const tag of ['<h1>','<strong>','<ol>','<table>','<code class="language-bash">'])expect(html).toContain(tag)
  expect(html).toContain('nvidia-smi --query-gpu=temperature.gpu')
 })
 it('escapes raw HTML and blocks active links and remote image loading',()=>{
  const html=renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n[x](data:text/html,bad)\n\n![tracker](https://example.com/track)')
  expect(html).not.toMatch(/<(script|img|iframe)\b/)
  expect(html).not.toContain('href=')
  expect(html).toContain('未自动加载')
 })
 it('escapes code and isolates explicit HTTPS links',()=>{
  const html=renderMarkdown('```html\n<script>alert(1)</script>\n```\n\n[来源](https://example.com)')
  expect(html).toContain('&lt;script&gt;');expect(html).toContain('rel="noopener noreferrer"')
 })
 it('exports an offline document and escapes title and provenance',()=>{
  const html=formattedDocument('</title><script>x</script>','## 诊断',['<img src=x onerror=alert(1)>'])
  expect(html).toContain('<h2>诊断</h2>');expect(html).not.toMatch(/<(script|img)\b/)
  expect(html).toContain('default-src');expect(html).toContain('<style>')
 })
})
