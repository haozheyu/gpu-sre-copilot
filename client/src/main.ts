// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
import { createApp } from 'vue'
import {Capacitor} from '@capacitor/core'
import App from './App.vue'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import './style.css'
createApp(App).mount('#app')
if(import.meta.env.PROD && !window.desktop && !Capacitor.isNativePlatform() && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1') && 'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})
