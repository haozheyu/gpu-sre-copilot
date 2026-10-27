// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..')
const target=path.join(root,'public/knowledge.json')
if(!fs.existsSync(target)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,'examples/knowledge.demo.json'),target)}
