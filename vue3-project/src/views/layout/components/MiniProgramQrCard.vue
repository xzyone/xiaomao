<script setup>
import { ref } from 'vue'
import miniProgramQrCode from '@/assets/imgs/mini-program-qrcode.jpg'

const dismissalKey = 'xiaomao:mini-program-qr-dismissed'
const visible = ref(true)

// Keep the card dismissed across route changes and sidebar remounts in this tab.
try {
  visible.value = sessionStorage.getItem(dismissalKey) !== '1'
} catch {
  // The close button still works when browser storage is unavailable.
}

function dismiss() {
  visible.value = false
  try {
    sessionStorage.setItem(dismissalKey, '1')
  } catch {
    // Storage may be disabled by the browser.
  }
}
</script>

<template>
  <aside v-if="visible" class="mini-program-qr-card" aria-label="微信小程序二维码">
    <button type="button" class="close-button" aria-label="关闭小程序二维码" @click="dismiss">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
    <p class="card-title">微信小程序</p>
    <img :src="miniProgramQrCode" class="qr-code" width="148" height="148" alt="小毛毛微信小程序码，使用微信扫一扫打开" />
    <p class="card-caption">微信扫一扫，打开小程序</p>
  </aside>
</template>

<style scoped>
.mini-program-qr-card {
  position: relative;
  box-sizing: border-box;
  width: 184px;
  margin: 0 auto 16px;
  padding: 14px 12px 12px;
  border: 1px solid var(--border-color-primary);
  border-radius: 16px;
  background: var(--bg-color-primary);
  box-shadow: 0 4px 16px var(--shadow-color);
  text-align: center;
}

.close-button {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-color-secondary);
  cursor: pointer;
}

.close-button:hover {
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
}

.close-button:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.card-title {
  margin: 0 20px 10px;
  color: var(--text-color-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.qr-code {
  display: block;
  margin: 0 auto;
  border-radius: 8px;
  background: #fff;
}

.card-caption {
  margin: 10px 0 0;
  color: var(--text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}
</style>
