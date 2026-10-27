// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{chat:(key,body)=>ipcRenderer.invoke('chat',key,body),getKey:()=>ipcRenderer.invoke('key:get'),setKey:key=>ipcRenderer.invoke('key:set',key),clearKey:()=>ipcRenderer.invoke('key:clear'),cancel:()=>ipcRenderer.invoke('chat:cancel')});
