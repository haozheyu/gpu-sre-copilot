// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
export interface Knowledge { id:string; title:string; body:string; source:string; verified:boolean; kind:'qa'|'document'|'learned'; updatedAt:string; fingerprint?:string }
export interface Hit { record:Knowledge; score:number; coverage:number; exact:boolean }
export interface Turn { id:string; question:string; answer:string; route:'local'|'deepseek'; sources:string[]; createdAt:string; learning?:string }
export interface Media { kind:'image'|'video'|'audio'; name:string; images:string[]; note:string }
