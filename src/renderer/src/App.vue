<template>
  <div class="app-container">
    <div class="title-bar">
      <div class="picker">
        <div class="picker-slider" :class="{ right: currentIndex === 1 }"></div>
        <div v-for="(option, index) in options" :key="index" class="picker-item"
          :class="{ active: currentIndex === index }" @click="switchTo(index)">
          {{ option }}
        </div>
      </div>
      <div v-if="!isMac" class="window-controls">
        <button class="win-btn win-min" @click="window.electron.minimize()" title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        <button class="win-btn win-max" @click="window.electron.maximize()" title="最大化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1" />
          </svg>
        </button>
        <button class="win-btn win-close" @click="window.electron.close()" title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
    <div class="content">
      <div class="translation-layout">
        <h2 class="title">{{ options[currentIndex] }}</h2>

        <div class="panels">
          <div class="panel">
            <textarea v-model="inputText" class="text-input" :placeholder="currentIndex === 0 ? '请输入中文...' : '请输入烦文...'"
              @input="autoResize($event)" @focus="selectAll($event)"></textarea>
          </div>
          <div class="panel-btn">
            <button class="translate-btn" :class="{ loading: translating }" :disabled="translating" @click="translate">
              <svg v-if="!translating" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10H16M13 7L16 10L13 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              <span v-else class="spinner"></span>
            </button>
            <span class="shortcut-hint">{{ shortcutHint }}</span>
          </div>
          <div class="panel">
            <div class="output-wrapper" :class="{ 'has-content': outputText && !translating }">
              <textarea ref="outputEl" class="text-output" :value="outputText" readonly
                :placeholder="translating ? '翻译中...' : '翻译结果将显示在这里...'"></textarea>
              <button v-if="outputText && !translating" class="copy-btn" @click="copyOutput" title="复制译文">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="4.5" y="4.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3" />
                  <path d="M2.5 11.5V3C2.5 2.17157 3.17157 1.5 4 1.5H10.5" stroke="currentColor" stroke-width="1.3"
                    stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div v-if="records.length" class="records">
          <div v-for="(record, index) in records" :key="index" class="record-item">
            <div class="record-source">{{ record.source }}</div>
            <div class="record-arrow">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7H12M9 4L12 7L9 10" stroke="#348AFF" stroke-width="1.5" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
            <div class="record-result">{{ record.result }}</div>
            <button class="record-copy" @click="copyRecord(record.result)" title="复制">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="4.5" y="4.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3" />
                <path d="M2.5 11.5V3C2.5 2.17157 3.17157 1.5 4 1.5H10.5" stroke="currentColor" stroke-width="1.3"
                  stroke-linecap="round" />
              </svg>
            </button>
            <button class="record-delete" @click="deleteRecord(index)" title="删除">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 5H13M6 5V3.5c0-.28.22-.5.5-.5h3c.28 0 .5.22.5.5V5M5 5v8.5c0 .28.22.5.5.5h5c.28 0 .5-.22.5-.5V5"
                  stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
          <div class="records-spacer"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { apiUrl } from './config/api-url'
import { xAppToken } from './config/x-app-token'
interface Record {
  source: string
  result: string
  direction: string
}

const options = ['中译烦', '烦译中']
const currentIndex = ref(0)
const inputText = ref('')
const outputText = ref('')
const records = ref<Record[]>([])
const translating = ref(false)

const isMac = navigator.platform.includes('Mac')

const STORAGE_KEY = 'translation_records'
const MAX_RECORDS = 100
const API_BASE = apiUrl

function loadRecords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      records.value = JSON.parse(saved)
    }
  } catch { }
}

function saveRecords() {
  try {
    const trimmed = records.value.slice(0, MAX_RECORDS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch { }
}

function switchTo(index: number) {
  currentIndex.value = index
  inputText.value = ''
  outputText.value = ''
}

const outputEl = ref<HTMLTextAreaElement | null>(null)
const shortcutHint = navigator.platform.includes('Mac') ? '⌘⏎' : 'Ctrl⏎'

function resizeOutput() {
  nextTick(() => {
    const el = outputEl.value
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.max(100, el.scrollHeight) + 'px'
    }
  })
}

watch(outputText, () => {
  resizeOutput()
})

async function translate() {
  if (!inputText.value.trim()) return

  translating.value = true
  outputText.value = ''

  const direction = currentIndex.value === 0 ? 'zh2fan' : 'fan2zh'

  try {
    const response = await fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': xAppToken
      },
      body: JSON.stringify({
        text: inputText.value,
        direction
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as any).detail || `请求失败 (${response.status})`)
    }

    const data = await response.json()
    const result = data.result

    outputText.value = result
    records.value.unshift({
      source: inputText.value,
      result,
      direction: options[currentIndex.value]
    })
    if (records.value.length > MAX_RECORDS) {
      records.value = records.value.slice(0, MAX_RECORDS)
    }
    saveRecords()
  } catch (e: any) {
    outputText.value = `错误: ${e.message || '未知错误'}`
  } finally {
    translating.value = false
  }
}

function copyOutput() {
  if (!outputText.value) return
  navigator.clipboard.writeText(outputText.value)
}

function copyRecord(text: string) {
  navigator.clipboard.writeText(text)
}

function deleteRecord(index: number) {
  records.value.splice(index, 1)
  saveRecords()
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = Math.max(100, el.scrollHeight) + 'px'
}

function selectAll(e: Event) {
  (e.target as HTMLTextAreaElement).select()
}

function handleKeydown(e: KeyboardEvent) {
  const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey
  if (mod && e.key === 'Enter') {
    e.preventDefault()
    translate()
  }
}

onMounted(() => {
  loadRecords()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style>
:root {
  --bg: #f5f5f5;
  --bg-card: #fff;
  --bg-card-alt: #f8f8f8;
  --bg-picker: #e8e8e8;
  --text-primary: #333;
  --text-secondary: #555;
  --text-muted: #888;
  --text-placeholder: #aaa;
  --border: #dcdcdc;
  --border-light: #eee;
  --accent: #348AFF;
  --accent-hover: #2a7ae6;
  --accent-active: #2269cc;
  --btn-hover-bg: rgba(0, 0, 0, 0.06);
  --slider-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a2e;
    --bg-card: #252536;
    --bg-card-alt: #2a2a3e;
    --bg-picker: #3a3a4e;
    --text-primary: #e0e0e0;
    --text-secondary: #b0b0b0;
    --text-muted: #808080;
    --text-placeholder: #666;
    --border: #3a3a4e;
    --border-light: #333350;
    --btn-hover-bg: rgba(255, 255, 255, 0.08);
    --slider-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}
</style>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.title-bar {
  flex-shrink: 0;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: drag;
  padding: 4px 6px 0 6px;
}

.picker {
  position: relative;
  display: flex;
  background: var(--bg-picker);
  border-radius: 8px;
  padding: 2px;
  cursor: pointer;
  user-select: none;
  -webkit-app-region: no-drag;
}

.picker-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(50% - 2px);
  height: calc(100% - 4px);
  background: var(--bg-card);
  border-radius: 7px;
  box-shadow: var(--slider-shadow);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.picker-slider.right {
  transform: translateX(100%);
}

.picker-item {
  position: relative;
  z-index: 1;
  padding: 5px 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  transition: color 0.25s;
  border-radius: 7px;
  white-space: nowrap;
}

.picker-item.active {
  color: var(--text-primary);
}

.content {
  flex: 1;
  -webkit-app-region: no-drag;
  display: flex;
  justify-content: center;
  padding: 16px 24px 40px;
  overflow-y: auto;
}

.translation-layout {
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 20px;
  flex-shrink: 0;
}

.panels {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  flex-shrink: 0;
}

.panel {
  flex: 1;
}

.output-wrapper {
  position: relative;
  width: 100%;
}

.copy-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--btn-hover-bg);
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, background 0.15s, color 0.15s;
  opacity: 0;
}

.output-wrapper.has-content:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  background: var(--btn-hover-bg);
  color: var(--accent);
}

.text-input,
.text-output {
  width: 100%;
  min-height: 100px;
  max-height: 320px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  font-size: 14px;
  line-height: 1.8;
  resize: none;
  outline: none;
  background: var(--bg-card);
  color: var(--text-primary);
  transition: border-color 0.2s;
  font-family: inherit;
}

.text-input::placeholder,
.text-output::placeholder {
  color: var(--text-placeholder);
}

.text-input:focus {
  border-color: var(--accent);
}

.text-output {
  background: var(--bg-card-alt);
  color: var(--text-secondary);
}

.panel-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
}

.translate-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.15s;
}

.translate-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.translate-btn:active:not(:disabled) {
  background: var(--accent-active);
  transform: scale(0.95);
}

.translate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.translate-btn.loading {
  background: #7cb5f2;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.shortcut-hint {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.records {
  width: 100%;
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
  transition: border-color 0.15s;
}

.record-item:hover {
  border-color: var(--border);
}

.record-source {
  flex: 1;
  color: var(--text-primary);
  word-break: break-all;
  min-width: 0;
}

.record-arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding-top: 2px;
}

.record-result {
  flex: 1;
  color: var(--text-secondary);
  word-break: break-all;
  min-width: 0;
}

.record-copy {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}

.record-copy:hover {
  color: var(--accent);
  background: var(--btn-hover-bg);
}

.record-delete {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}

.record-delete:hover {
  color: #e81123;
  background: var(--btn-hover-bg);
}

.records-spacer {
  height: 24px;
  flex-shrink: 0;
}

.window-controls {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 8px;
  -webkit-app-region: no-drag;
}

.win-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.win-btn:hover {
  background: var(--btn-hover-bg);
  color: var(--text-primary);
}

.win-close:hover {
  background: #e81123;
  color: #fff;
}
</style>
