// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import {Capacitor} from '@capacitor/core'
import {Filesystem,Directory} from '@capacitor/filesystem'
import {Share} from '@capacitor/share'
export async function saveFile(name:string,value:Blob|string,type='application/json'){
 const blob=value instanceof Blob?value:new Blob([value],{type})
 if(Capacitor.isNativePlatform()){
   const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('文件转换失败。'));reader.readAsDataURL(blob)})
   const file=await Filesystem.writeFile({path:name,data:base64,directory:Directory.Cache})
   await Share.share({title:name,url:file.uri,dialogTitle:'保存或分享文件'})
 }else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
}
