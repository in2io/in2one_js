<!--
  Vue 3 から使う例。
    npm install @in2one/one-js
-->
<script setup lang="ts">
import { ref } from "vue";
import { In2OneEmbed } from "@in2one/one-js/vue";
import type { EmbedError, EmbedSubmitPayload } from "@in2one/one-js";

defineProps<{ hako: string }>();

const token = import.meta.env.VITE_IN2ONE_TOKEN as string;
const done = ref<string | null>(null);

const onSubmit = (payload: EmbedSubmitPayload): void => {
  done.value = payload.uuid ?? "";
};
const onError = (error: EmbedError): void => {
  console.error(error.code, error.message);
};
</script>

<template>
  <p v-if="done">ご予約を承りました（受付番号: {{ done }}）</p>
  <In2OneEmbed
    v-else
    feature="booking"
    :token="token"
    :params="{ hako }"
    locale="ja"
    theme="auto"
    class-name="rounded-xl shadow"
    @submit="onSubmit"
    @error="onError"
  />
</template>
