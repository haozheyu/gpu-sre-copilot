// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
export {}
declare global {interface Window {desktop?:{chat:(key:string,body:unknown)=>Promise<{status:number;data:unknown}>;getKey:()=>Promise<string>;setKey:(key:string)=>Promise<void>;clearKey:()=>Promise<void>;cancel:()=>Promise<void>}}}
