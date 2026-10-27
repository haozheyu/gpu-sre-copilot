// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import {Capacitor,registerPlugin} from '@capacitor/core'
export const nativeAndroid=Capacitor.getPlatform()==='android'
export const nativeVault=registerPlugin<{get():Promise<{key:string}>;set(options:{key:string}):Promise<void>;clear():Promise<void>}>('NativeVault')
