<!-- Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {computed} from 'vue'
import {renderMarkdown} from './markdown'
const props=defineProps<{text:string}>()
const html=computed(()=>renderMarkdown(props.text))
</script>
<template><div class="answer markdown-document" v-html="html"></div></template>
