<template>
  <div class="debug-panel">
    <el-card shadow="never" class="panel-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">日志开关</span>
          <el-switch v-model="enabled" :loading="toggling" @change="toggleDebug" :class="{ 'switch-off': !enabled }" active-text="记录中" inactive-text="已关闭" />
        </div>
      </template>
      <div class="form-tip">
        开启后会将与腾讯 API / AI 服务交互时的错误写入 KV。关闭时不产生任何 KV 写入，不消耗免费额度。最多保留最近 100 条日志。
      </div>
    </el-card>

    <el-card shadow="never" class="panel-card" style="margin-top:16px">
      <template #header>
        <div class="card-header">
          <span class="card-title">错误日志</span>
          <div class="header-actions">
            <el-button size="small" @click="loadLogs" :loading="loading">刷新</el-button>
            <el-button size="small" type="danger" plain @click="clearLogs" :disabled="logs.length === 0">清空</el-button>
          </div>
        </div>
      </template>
      <div v-if="loading && logs.length === 0" v-loading="true" style="min-height:120px"></div>
      <div v-else-if="logs.length === 0" class="empty-state">
        <el-empty description="暂无日志" :image-size="60" />
      </div>
      <div v-else class="log-list">
        <div v-for="log in logs" :key="log.id" class="log-item" :class="log.level">
          <div class="log-header">
            <el-tag :type="levelTagType(log.level)" size="small" effect="dark" round>{{ log.level.toUpperCase() }}</el-tag>
            <span class="log-source">{{ log.source }}</span>
            <span class="log-time">{{ formatTime(log.time) }}</span>
          </div>
          <div class="log-message">{{ log.message }}</div>
          <div v-if="log.detail" class="log-detail">
            <el-collapse>
              <el-collapse-item title="详情">
                <pre class="detail-pre">{{ JSON.stringify(log.detail, null, 2) }}</pre>
              </el-collapse-item>
            </el-collapse>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../api'

const enabled = ref(false)
const toggling = ref(false)
const loading = ref(false)
const logs = ref<any[]>([])

onMounted(async () => {
  await loadStatus()
  await loadLogs()
})

async function loadStatus() {
  try {
    const res = await api.get('/debug/status')
    enabled.value = res.enabled
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

async function toggleDebug(val: boolean) {
  toggling.value = true
  try {
    await api.post('/debug/toggle', { enabled: val })
    ElMessage.success(val ? 'Debug 日志已开启' : 'Debug 日志已关闭')
  } catch (e: any) {
    ElMessage.error(e.message)
    enabled.value = !val
  } finally {
    toggling.value = false
  }
}

async function loadLogs() {
  loading.value = true
  try {
    const res = await api.get('/debug/logs')
    logs.value = res.logs || []
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function clearLogs() {
  try {
    await api.post('/debug/clear', {})
    logs.value = []
    ElMessage.success('日志已清空')
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

function levelTagType(level: string) {
  if (level === 'error') return 'danger'
  if (level === 'warn') return 'warning'
  return 'info'
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.panel-card { border-radius: var(--card-radius, 8px); }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-weight: 600; font-size: 14px; }
.header-actions { display: flex; gap: 8px; }
.form-tip { font-size: 12px; color: #999; }
.switch-off :deep(.el-switch__label--left span) { color: #999 !important; }
.empty-state { padding: 20px 0; }
.log-list { display: flex; flex-direction: column; gap: 12px; max-height: 600px; overflow-y: auto; }
.log-item { padding: 10px 12px; border-radius: 6px; background: var(--bg-surface, #f9f9f9); border: 1px solid var(--border, #eee); }
.log-item.error { border-left: 3px solid var(--el-color-danger); }
.log-item.warn { border-left: 3px solid var(--el-color-warning); }
.log-item.info { border-left: 3px solid var(--el-color-info); }
.log-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.log-source { font-size: 12px; color: var(--text-secondary, #666); font-family: 'SF Mono', 'Fira Code', monospace; }
.log-time { font-size: 11px; color: #999; margin-left: auto; }
.log-message { font-size: 13px; color: var(--text-primary, #333); word-break: break-all; }
.log-detail { margin-top: 6px; }
.detail-pre { font-size: 11px; line-height: 1.4; white-space: pre-wrap; word-break: break-all; margin: 0; padding: 8px; background: var(--bg-elevated, #f0f0f0); border-radius: 4px; max-height: 200px; overflow-y: auto; }
</style>
