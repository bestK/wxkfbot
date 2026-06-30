<template>
  <div class="session-panel">
    <!-- 左侧：会话列表 -->
    <div class="session-list">
      <div class="list-header">
        <span class="title">会话列表</span>
        <el-button size="small" @click="loadSessions" :loading="loading" :icon="Refresh" circle />
      </div>

      <div class="list-body">
        <div
          v-for="s in sessions" :key="`${s.external_userid}__${s.open_kfid}`"
          class="session-item" :class="{ active: isActive(s) }"
          @click="selectSession(s)"
        >
          <el-avatar :size="36" :src="s.avatar || undefined">
            <el-icon><User /></el-icon>
          </el-avatar>
          <div class="session-info">
            <div class="session-user">{{ s.nickname || s.external_userid.slice(0, 12) }}</div>
            <div class="session-kf">{{ accountName(s.open_kfid) || s.open_kfid.slice(0, 12) }}</div>
          </div>
          <el-tag v-if="s.service_state >= 0" :type="stateTagType(s.service_state)" size="small" round effect="plain">
            {{ stateLabels[s.service_state] || '未知' }}
          </el-tag>
        </div>
        <el-empty v-if="!loading && sessions.length === 0" description="暂无会话" :image-size="60" />
      </div>
    </div>

    <!-- 右侧：聊天窗口 -->
    <div class="chat-area">
      <template v-if="current">
        <!-- 聊天头部 -->
        <div class="chat-header">
          <div class="chat-target">
            <el-avatar :size="32" :src="current.avatar || undefined">
              <el-icon><User /></el-icon>
            </el-avatar>
            <span class="name">{{ current.nickname || current.external_userid }}</span>
            <el-tag v-if="current.service_state >= 0" :type="stateTagType(current.service_state)" size="small" round>
              {{ stateLabels[current.service_state] || '未知' }}
            </el-tag>
          </div>
          <div class="chat-actions">
            <el-button size="small" @click="openTrans">变更状态</el-button>
            <el-button size="small" @click="refreshMessages" :loading="msgLoading">刷新消息</el-button>
          </div>
        </div>

        <!-- 消息列表 -->
        <div class="chat-messages" ref="msgContainer">
          <div v-for="msg in messages" :key="msg.msgid" class="msg-row" :class="msgDirection(msg)">
            <template v-if="msgDirection(msg) === 'incoming'">
              <div class="msg-avatar">
                <el-avatar :size="34" :src="current?.avatar || undefined">
                  <el-icon><User /></el-icon>
                </el-avatar>
              </div>
              <div class="msg-bubble-wrap">
                <div class="msg-bubble">
                  <div class="msg-content" v-html="renderMessage(msg)"></div>
                </div>
                <div class="msg-meta">
                  <span class="msg-time">{{ formatTime(msg.send_time) }}</span>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="msg-bubble-wrap">
                <div class="msg-bubble">
                  <div class="msg-content" v-html="renderMessage(msg)"></div>
                </div>
                <div class="msg-meta">
                  <span class="msg-time">{{ formatTime(msg.send_time) }}</span>
                  <el-button v-if="canRecall(msg.send_time)" link size="small" @click="recallMsg(msg.msgid)">撤回</el-button>
                </div>
              </div>
              <div class="msg-avatar">
                <el-avatar :size="34" :src="accountAvatar(current?.open_kfid) || undefined">
                  <el-icon><Service /></el-icon>
                </el-avatar>
              </div>
            </template>
          </div>
          <el-empty v-if="messages.length === 0 && !msgLoading" description="暂无消息记录" :image-size="60" />
        </div>

        <!-- 消息输入区 -->
        <div class="chat-input" @paste="handlePaste">
          <!-- 工具栏 -->
          <div class="composer-toolbar">
            <button v-for="t in msgTypes" :key="t.value" :class="['tool-btn', { active: msgType === t.value }]" @click="msgType = t.value" :title="t.label">
              <el-icon :size="16"><component :is="t.icon" /></el-icon>
            </button>
          </div>

          <!-- 文本输入 -->
          <div v-if="msgType === 'text'" class="composer-body">
            <div class="text-compose">
              <textarea v-model="textContent" placeholder="输入消息…  Enter 发送，Ctrl+Enter 换行" @keydown.enter.exact.prevent="sendCurrentMsg" @keydown.ctrl.enter.prevent="insertNewline" rows="3"></textarea>
              <button class="send-btn" @click="sendCurrentMsg" :disabled="!textContent.trim() || sending">
                <span v-if="sending" class="btn-spinner"></span>
                <span v-else>↑</span>
              </button>
            </div>
          </div>

          <!-- 媒体上传 -->
          <div v-if="['image','voice','video','file'].includes(msgType)" class="composer-body">
            <div class="media-compose" :class="{ 'has-file': mediaFileName, dragging: isDragging }" @dragover.prevent="isDragging = true" @dragleave="isDragging = false" @drop.prevent="handleDrop">
              <div v-if="!mediaFileName" class="drop-zone" @click="triggerFileInput">
                <el-icon :size="28" class="drop-icon"><component :is="msgTypes.find(t => t.value === msgType)?.icon" /></el-icon>
                <span class="drop-text">拖拽文件到此处 或 点击选择</span>
                <span class="drop-hint">{{ uploadHint }}</span>
              </div>
              <div v-else class="file-preview">
                <div class="file-info">
                  <span class="file-icon">📄</span>
                  <span class="file-name">{{ mediaFileName }}</span>
                  <span v-if="mediaId" class="upload-status done">✓ 已就绪</span>
                  <button class="file-remove" @click="clearMedia">✕</button>
                </div>
                <div v-if="uploading" class="upload-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
                  </div>
                  <span class="progress-text">{{ uploadProgress }}%</span>
                </div>
              </div>
              <input ref="fileInputRef" type="file" :accept="acceptTypes" hidden @change="handleFileInput" />
            </div>
            <div class="media-actions">
              <button class="send-btn" @click="sendCurrentMsg" :disabled="!mediaId.trim() || sending">
                <span v-if="sending" class="btn-spinner"></span>
                <span v-else>↑</span>
              </button>
            </div>
          </div>

          <!-- 链接消息 -->
          <div v-if="msgType === 'link'" class="composer-body">
            <div class="form-compose">
              <div class="form-row">
                <input v-model="linkForm.title" placeholder="标题" class="form-input" />
                <input v-model="linkForm.url" placeholder="链接 URL" class="form-input" />
              </div>
              <div class="form-row">
                <input v-model="linkForm.desc" placeholder="描述（可选）" class="form-input" />
                <input v-model="linkForm.thumb_media_id" placeholder="缩略图 media_id（可选）" class="form-input" />
              </div>
            </div>
            <div class="form-actions">
              <button class="send-btn" @click="sendCurrentMsg" :disabled="!linkForm.title || !linkForm.url || sending">
                <span v-if="sending" class="btn-spinner"></span>
                <span v-else>↑</span>
              </button>
            </div>
          </div>

          <!-- 小程序消息 -->
          <div v-if="msgType === 'miniprogram'" class="composer-body">
            <div class="form-compose">
              <div class="form-row">
                <input v-model="miniprogramForm.appid" placeholder="AppID" class="form-input" />
                <input v-model="miniprogramForm.title" placeholder="标题" class="form-input" />
              </div>
              <div class="form-row">
                <input v-model="miniprogramForm.pagepath" placeholder="页面路径" class="form-input" />
                <input v-model="miniprogramForm.thumb_media_id" placeholder="缩略图 media_id" class="form-input" />
              </div>
            </div>
            <div class="form-actions">
              <button class="send-btn" @click="sendCurrentMsg" :disabled="!miniprogramForm.appid || !miniprogramForm.title || sending">
                <span v-if="sending" class="btn-spinner"></span>
                <span v-else>↑</span>
              </button>
            </div>
          </div>

          <!-- 菜单消息 -->
          <div v-if="msgType === 'msgmenu'" class="composer-body">
            <div class="form-compose">
              <input v-model="menuForm.head_content" placeholder="头部内容" class="form-input" />
              <div class="menu-items">
                <div v-for="(item, idx) in menuForm.list" :key="idx" class="menu-row">
                  <select v-model="item.type" class="form-select">
                    <option value="click">回复</option>
                    <option value="view">链接</option>
                    <option value="miniprogram">小程序</option>
                  </select>
                  <input v-model="item.content" placeholder="显示内容" class="form-input" />
                  <input v-if="item.type === 'click'" v-model="item.id" placeholder="ID" class="form-input sm" />
                  <input v-if="item.type === 'view'" v-model="item.url" placeholder="URL" class="form-input" />
                  <button class="menu-del" @click="menuForm.list.splice(idx, 1)">✕</button>
                </div>
                <button class="menu-add" @click="menuForm.list.push({ type: 'click', content: '', id: '', url: '' })">+ 添加菜单项</button>
              </div>
              <input v-model="menuForm.tail_content" placeholder="尾部内容" class="form-input" />
            </div>
            <div class="form-actions">
              <button class="send-btn" @click="sendCurrentMsg" :disabled="menuForm.list.length === 0 || sending">
                <span v-if="sending" class="btn-spinner"></span>
                <span v-else>↑</span>
              </button>
            </div>
          </div>

          <!-- 位置消息 -->
          <div v-if="msgType === 'location'" class="composer-body">
            <div class="form-compose">
              <div class="form-row">
                <input v-model="locationForm.name" placeholder="位置名称" class="form-input" />
                <input v-model="locationForm.address" placeholder="详细地址" class="form-input" />
              </div>
              <div class="form-row">
                <input v-model="locationForm.latitude" placeholder="纬度" type="number" step="any" class="form-input" />
                <input v-model="locationForm.longitude" placeholder="经度" type="number" step="any" class="form-input" />
              </div>
            </div>
            <div class="form-actions">
              <button class="send-btn" @click="sendCurrentMsg" :disabled="!locationForm.latitude || !locationForm.longitude || sending">
                <span v-if="sending" class="btn-spinner"></span>
                <span v-else>↑</span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="chat-placeholder">
        <el-empty description="选择一个会话开始聊天" :image-size="100" />
      </div>
    </div>

    <!-- 变更状态对话框 -->
    <el-dialog v-model="transVisible" title="变更会话状态" width="420px">
      <el-form label-width="100px">
        <el-form-item label="用户">
          <el-text class="mono">{{ current?.external_userid }}</el-text>
        </el-form-item>
        <el-form-item label="目标状态">
          <el-select v-model="transForm.service_state" style="width:100%">
            <el-option :value="0" label="未处理" />
            <el-option :value="1" label="由智能助手接待" />
            <el-option :value="2" label="待接入池排队中" />
            <el-option :value="3" label="由人工接待" />
            <el-option :value="4" label="已结束" />
          </el-select>
        </el-form-item>
        <el-form-item label="接待人员" v-if="transForm.service_state === 3">
          <el-input v-model="transForm.servicer_userid" placeholder="userid" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="transVisible = false">取消</el-button>
        <el-button type="primary" @click="transState" :loading="transLoading">确认变更</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, markRaw } from 'vue'
import { ElMessage } from 'element-plus'
import { EditPen, Picture, Microphone, VideoCamera, Document, Link, Monitor, Menu, Location, Refresh } from '@element-plus/icons-vue'
import { api, mediaUrl } from '../api'

const loading = ref(false)
const msgLoading = ref(false)
const sending = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const transLoading = ref(false)
const transVisible = ref(false)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement>()

const accounts = ref<any[]>([])
const sessions = ref<any[]>([])
const current = ref<any>(null)
const messages = ref<any[]>([])
const msgContainer = ref<HTMLElement>()
const syncToken = ref('')

const msgType = ref('text')
const textContent = ref('')
const mediaId = ref('')
const mediaFile = ref<File | null>(null)
const mediaFileName = ref('')
const linkForm = ref({ title: '', desc: '', url: '', thumb_media_id: '' })
const miniprogramForm = ref({ appid: '', title: '', thumb_media_id: '', pagepath: '' })
const menuForm = ref({ head_content: '', list: [{ type: 'click', content: '', id: '', url: '' }] as any[], tail_content: '' })
const locationForm = ref({ name: '', address: '', latitude: '', longitude: '' })
const transForm = ref({ service_state: 0, servicer_userid: '' })

const msgTypes = [
  { value: 'text', label: '文本', icon: markRaw(EditPen) },
  { value: 'image', label: '图片', icon: markRaw(Picture) },
  { value: 'voice', label: '语音', icon: markRaw(Microphone) },
  { value: 'video', label: '视频', icon: markRaw(VideoCamera) },
  { value: 'file', label: '文件', icon: markRaw(Document) },
  { value: 'link', label: '链接', icon: markRaw(Link) },
  { value: 'miniprogram', label: '小程序', icon: markRaw(Monitor) },
  { value: 'msgmenu', label: '菜单', icon: markRaw(Menu) },
  { value: 'location', label: '位置', icon: markRaw(Location) },
]

const acceptTypes = computed(() => {
  switch (msgType.value) {
    case 'image': return 'image/jpeg,image/png'
    case 'voice': return 'audio/amr'
    case 'video': return 'video/mp4'
    default: return '*'
  }
})

const uploadHint = computed(() => {
  switch (msgType.value) {
    case 'image': return 'JPG/PNG, ≤2MB'
    case 'voice': return 'AMR, ≤2MB, ≤60s'
    case 'video': return 'MP4, ≤10MB'
    case 'file': return '≤20MB'
    default: return ''
  }
})

const stateLabels: Record<number, string> = {
  0: '未处理', 1: '智能助手', 2: '排队中', 3: '人工接待', 4: '已结束',
}

function stateTagType(s: number) {
  if (s === 3) return 'success'
  if (s === 4) return 'info'
  if (s === 2) return 'warning'
  if (s === 1) return ''
  return 'danger'
}

function accountName(kfid: string) {
  return accounts.value.find((a: any) => a.open_kfid === kfid)?.name
}

function accountAvatar(kfid: string) {
  return accounts.value.find((a: any) => a.open_kfid === kfid)?.avatar || ''
}

function isActive(s: any) {
  return current.value && current.value.external_userid === s.external_userid && current.value.open_kfid === s.open_kfid
}

function msgDirection(msg: any) {
  // origin: 3=客户回复, 4=系统推送; origin=5为本地发送记录
  return msg.origin === 3 ? 'incoming' : 'outgoing'
}

function formatTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function canRecall(sendTime: number): boolean {
  if (!sendTime) return false
  return (Date.now() / 1000 - sendTime) < 120
}

function renderMessage(msg: any) {
  const t = msg.msgtype
  if (t === 'text') return escapeHtml(msg.text?.content || msg.text?.menu_id || '')
  if (t === 'image') {
    const mid = msg.image?.media_id
    if (mid) {
      return `<img class="msg-img" src="${mediaUrl(mid)}" alt="图片" loading="lazy" onclick="window.open(this.src)" />`
    }
    return `<span class="media-tag"><svg class="inline-icon" viewBox="0 0 1024 1024"><path d="M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zM338 304c35.3 0 64 28.7 64 64s-28.7 64-64 64-64-28.7-64-64 28.7-64 64-64zm550 512H136c-4.4 0-8-3.6-8-8v-72l154-154 92 92 216-216 306 306v44c0 4.4-3.6 8-8 8z"/></svg> 图片</span>`
  }
  if (t === 'voice') {
    const mid = msg.voice?.media_id
    if (mid) {
      return `<div class="msg-voice"><svg class="inline-icon voice-icon" viewBox="0 0 1024 1024"><path d="M512 704c106 0 192-86 192-192V256c0-106-86-192-192-192S320 150 320 256v256c0 106 86 192 192 192zm-64-448c0-35.3 28.7-64 64-64s64 28.7 64 64v256c0 35.3-28.7 64-64 64s-64-28.7-64-64V256zm320 256c0 141.4-114.6 256-256 256S256 653.4 256 512h-64c0 159.1 117.8 290.6 272 311.5V896h-96v64h256v-64h-96v-72.5c154.2-20.9 272-152.4 272-311.5h-64z"/></svg><span class="voice-dur">${msg.voice?.duration ? Math.ceil(msg.voice.duration / 1000) + '"' : ''}</span><audio src="${mediaUrl(mid)}" controls preload="none"></audio></div>`
    }
    return `<span class="media-tag"><svg class="inline-icon" viewBox="0 0 1024 1024"><path d="M512 704c106 0 192-86 192-192V256c0-106-86-192-192-192S320 150 320 256v256c0 106 86 192 192 192z"/></svg> 语音</span>`
  }
  if (t === 'video') {
    const mid = msg.video?.media_id
    if (mid) {
      return `<video class="msg-video" src="${mediaUrl(mid)}" controls preload="metadata"></video>`
    }
    return `<span class="media-tag"><svg class="inline-icon" viewBox="0 0 1024 1024"><path d="M912 302.3L784 376V224c0-35.3-28.7-64-64-64H128c-35.3 0-64 28.7-64 64v576c0 35.3 28.7 64 64 64h592c35.3 0 64-28.7 64-64V648l128 73.7c21.3 12.3 48-3.1 48-27.6V330c0-24.6-26.7-40-48-27.7z"/></svg> 视频</span>`
  }
  if (t === 'file') {
    const mid = msg.file?.media_id
    const fileName = msg.file?.file_name || '文件'
    const fileSize = msg.file?.file_size ? formatFileSize(msg.file.file_size) : ''
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const iconSvg = getFileIcon(ext)
    if (mid) {
      return `<a class="msg-file" href="${mediaUrl(mid)}" target="_blank" download="${escapeHtml(fileName)}">${iconSvg}<div class="file-info"><span class="file-name">${escapeHtml(fileName)}</span><span class="file-size">${fileSize}</span></div></a>`
    }
    return `<span class="media-tag">${iconSvg} ${escapeHtml(fileName)}</span>`
  }
  if (t === 'link') {
    const url = msg.link?.url || ''
    const title = msg.link?.title || '链接'
    const desc = msg.link?.desc || ''
    return `<a class="msg-link-card" href="${escapeHtml(url)}" target="_blank"><span class="link-title">${escapeHtml(title)}</span><span class="link-desc">${escapeHtml(desc)}</span></a>`
  }
  if (t === 'miniprogram') return `<span class="media-tag"><svg class="inline-icon" viewBox="0 0 1024 1024" style="color:#07C160"><path fill="currentColor" d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/></svg> 小程序: ${escapeHtml(msg.miniprogram?.title || '')}</span>`
  if (t === 'msgmenu') {
    const head = msg.msgmenu?.head_content || ''
    const list = msg.msgmenu?.list || []
    const tail = msg.msgmenu?.tail_content || ''
    let html = head ? `<div class="menu-head">${escapeHtml(head)}</div>` : ''
    if (list.length) {
      html += `<div class="menu-list">${list.map((item: any) => `<span class="menu-item">${escapeHtml(item.content || item.id || '')}</span>`).join('')}</div>`
    }
    if (tail) html += `<div class="menu-tail">${escapeHtml(tail)}</div>`
    return html || `<span class="media-tag">菜单消息</span>`
  }
  if (t === 'location') return `<div class="msg-location"><svg class="inline-icon loc-icon" viewBox="0 0 1024 1024"><path fill="#e74c3c" d="M512 64C336.6 64 192 205.3 192 376c0 240 320 584 320 584s320-344 320-584C832 205.3 687.4 64 512 64zm0 440c-75.1 0-136-60.9-136-136s60.9-136 136-136 136 60.9 136 136-60.9 136-136 136z"/></svg><div class="loc-info"><span class="loc-name">${escapeHtml(msg.location?.name || '位置')}</span><span class="loc-addr">${escapeHtml(msg.location?.address || '')}</span></div></div>`
  if (t === 'event') return `<span class="media-tag sys-event">${eventLabel(msg.event?.event_type)}</span>`
  return `<span class="media-tag">[${t || '未知'}]</span>`
}

function getFileIcon(ext: string): string {
  const pdfIcon = '<svg class="file-icon-svg" viewBox="0 0 1024 1024"><path fill="#e74c3c" d="M854.6 288.6L639.4 73.4c-6-6-14.1-9.4-22.6-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.2c0-8.5-3.4-16.7-9.4-22.6z"/></svg>'
  const docIcon = '<svg class="file-icon-svg" viewBox="0 0 1024 1024"><path fill="#2b579a" d="M854.6 288.6L639.4 73.4c-6-6-14.1-9.4-22.6-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.2c0-8.5-3.4-16.7-9.4-22.6z"/></svg>'
  const xlsIcon = '<svg class="file-icon-svg" viewBox="0 0 1024 1024"><path fill="#217346" d="M854.6 288.6L639.4 73.4c-6-6-14.1-9.4-22.6-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.2c0-8.5-3.4-16.7-9.4-22.6z"/></svg>'
  const defaultIcon = '<svg class="file-icon-svg" viewBox="0 0 1024 1024"><path fill="#999" d="M854.6 288.6L639.4 73.4c-6-6-14.1-9.4-22.6-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.2c0-8.5-3.4-16.7-9.4-22.6z"/></svg>'
  if (ext === 'pdf') return pdfIcon
  if (['doc', 'docx'].includes(ext)) return docIcon
  if (['xls', 'xlsx', 'csv'].includes(ext)) return xlsIcon
  if (['ppt', 'pptx'].includes(ext)) return '<svg class="file-icon-svg" viewBox="0 0 1024 1024"><path fill="#d24726" d="M854.6 288.6L639.4 73.4c-6-6-14.1-9.4-22.6-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.2c0-8.5-3.4-16.7-9.4-22.6z"/></svg>'
  if (['zip', 'rar', '7z'].includes(ext)) return '<svg class="file-icon-svg" viewBox="0 0 1024 1024"><path fill="#f39c12" d="M854.6 288.6L639.4 73.4c-6-6-14.1-9.4-22.6-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.2c0-8.5-3.4-16.7-9.4-22.6z"/></svg>'
  return defaultIcon
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    enter_session: '进入会话',
    msg_send_fail: '发送失败',
    servicer_status_change: '接待状态变更',
    session_status_change: '会话状态变更',
  }
  return map[type] || type || '系统事件'
}

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function loadAccounts() {
  try {
    const res = await api.get('/kf/accounts')
    accounts.value = res?.account_list || []
  } catch (_) {}
}

async function loadSessions() {
  loading.value = true
  try {
    const msgRes = await api.post('/kf/sync_msg', { limit: 1000 })
    const msgList = msgRes?.msg_list || []

    const seen = new Map<string, any>()
    for (const msg of msgList) {
      if (!msg.external_userid || !msg.open_kfid) continue
      const key = `${msg.external_userid}__${msg.open_kfid}`
      if (!seen.has(key)) {
        seen.set(key, { external_userid: msg.external_userid, open_kfid: msg.open_kfid })
      }
    }

    const pairs = Array.from(seen.values())

    // 批量获取客户信息
    const externalUserids = [...new Set(pairs.map((p: any) => p.external_userid))]
    let customerMap: Record<string, any> = {}
    if (externalUserids.length > 0) {
      try {
        const custRes = await api.post('/kf/customer/info', { external_userid_list: externalUserids, need_enter_session_context: 0 })
        for (const c of (custRes?.customer_list || [])) {
          customerMap[c.external_userid] = c
        }
      } catch (_) {}
    }

    const results: any[] = []
    for (const p of pairs) {
      const cust = customerMap[p.external_userid]
      try {
        const state = await api.post('/kf/service_state', {
          open_kfid: p.open_kfid,
          external_userid: p.external_userid,
        })
        results.push({ ...p, service_state: state?.service_state, servicer_userid: state?.servicer_userid, nickname: cust?.nickname || '', avatar: cust?.avatar || '' })
      } catch (_) {
        results.push({ ...p, service_state: -1, servicer_userid: '', nickname: cust?.nickname || '', avatar: cust?.avatar || '' })
      }
    }
    sessions.value = results
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function selectSession(s: any) {
  current.value = s
  messages.value = []
  syncToken.value = ''
  await loadMessages()
}

async function loadMessages(silent = false) {
  if (!current.value) return
  if (!silent) msgLoading.value = true
  try {
    // 首次全量拉取：循环拉直到 has_more=false
    let allMsgs: any[] = []
    let cursor = ''
    let token = ''
    while (true) {
      const params: any = { limit: 1000, open_kfid: current.value.open_kfid }
      if (cursor) params.cursor = cursor
      const syncRes = await api.post('/kf/sync_msg', params)
      const batch = (syncRes?.msg_list || [])
        .filter((m: any) => m.external_userid === current.value.external_userid && m.open_kfid === current.value.open_kfid)
      allMsgs = allMsgs.concat(batch)
      token = syncRes?.next_cursor || ''
      if (!syncRes?.has_more) break
      cursor = syncRes.next_cursor || ''
    }
    // 保存 token 用于后续增量同步
    syncToken.value = token

    const sentRes = await api.post('/kf/sent_messages', { open_kfid: current.value.open_kfid, external_userid: current.value.external_userid })
    const sentMsgs = sentRes?.msg_list || []

    messages.value = deduplicateMessages(allMsgs, sentMsgs)
    await nextTick()
    scrollToBottom()
  } catch (_) {
    if (!silent) ElMessage.error('加载消息失败')
  } finally {
    msgLoading.value = false
  }
}

async function refreshMessages() {
  if (!current.value) return
  if (!syncToken.value) { await loadMessages(); return }
  msgLoading.value = true
  try {
    const syncRes = await api.post('/kf/sync_msg', {
      limit: 1000,
      open_kfid: current.value.open_kfid,
      token: syncToken.value,
    })
    const newMsgs = (syncRes?.msg_list || [])
      .filter((m: any) => m.external_userid === current.value.external_userid && m.open_kfid === current.value.open_kfid)
    if (syncRes?.next_cursor) syncToken.value = syncRes.next_cursor

    const sentRes = await api.post('/kf/sent_messages', { open_kfid: current.value.open_kfid, external_userid: current.value.external_userid })
    const sentMsgs = sentRes?.msg_list || []

    if (newMsgs.length || sentMsgs.length) {
      const existingIds = new Set(messages.value.map((m: any) => m.msgid))
      const incomingNew = newMsgs.filter((m: any) => !existingIds.has(m.msgid))
      const allIncoming = [...messages.value.filter((m: any) => !m.msgid.startsWith('sent_')), ...incomingNew]
      messages.value = deduplicateMessages(allIncoming, sentMsgs)
      if (incomingNew.length) {
        await nextTick()
        scrollToBottom()
      }
    }
  } catch (_) {}
  finally {
    msgLoading.value = false
  }
}

function deduplicateMessages(incomingMsgs: any[], sentMsgs: any[]) {
  const seen = new Set(incomingMsgs.map((m: any) => m.msgid))
  const incomingTimes = new Set(incomingMsgs.map((m: any) => `${m.send_time}_${m.msgtype}_${m.origin}`))
  const dedupedSent = sentMsgs.filter((m: any) => {
    if (seen.has(m.msgid)) return false
    if (incomingTimes.has(`${m.send_time}_${m.msgtype}_5`)) return false
    return true
  })
  return [...incomingMsgs, ...dedupedSent]
    .sort((a: any, b: any) => (a.send_time || 0) - (b.send_time || 0))
}

function scrollToBottom() {
  if (msgContainer.value) {
    msgContainer.value.scrollTop = msgContainer.value.scrollHeight
  }
}

async function sendCurrentMsg() {
  if (!current.value) return
  sending.value = true
  try {
    const payload = buildPayload()
    await api.post('/kf/send_msg', payload)
    ElMessage.success('发送成功')
    resetInput()
    await refreshMessages()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    sending.value = false
  }
}

function buildPayload() {
  const base = { touser: current.value.external_userid, open_kfid: current.value.open_kfid, msgtype: msgType.value }
  switch (msgType.value) {
    case 'text':
      return { ...base, text: { content: textContent.value } }
    case 'image':
      return { ...base, image: { media_id: mediaId.value } }
    case 'voice':
      return { ...base, voice: { media_id: mediaId.value } }
    case 'video':
      return { ...base, video: { media_id: mediaId.value } }
    case 'file':
      return { ...base, file: { media_id: mediaId.value } }
    case 'link':
      return { ...base, link: { ...linkForm.value } }
    case 'miniprogram':
      return { ...base, miniprogram: { ...miniprogramForm.value } }
    case 'msgmenu':
      return { ...base, msgmenu: { head_content: menuForm.value.head_content, list: menuForm.value.list, tail_content: menuForm.value.tail_content } }
    case 'location':
      return { ...base, location: { name: locationForm.value.name, address: locationForm.value.address, latitude: Number(locationForm.value.latitude), longitude: Number(locationForm.value.longitude) } }
    default:
      return base
  }
}

function resetInput() {
  textContent.value = ''
  mediaId.value = ''
  mediaFile.value = null
  mediaFileName.value = ''
  linkForm.value = { title: '', desc: '', url: '', thumb_media_id: '' }
  miniprogramForm.value = { appid: '', title: '', thumb_media_id: '', pagepath: '' }
  menuForm.value = { head_content: '', list: [{ type: 'click', content: '', id: '', url: '' }], tail_content: '' }
  locationForm.value = { name: '', address: '', latitude: '', longitude: '' }
}

function insertNewline() {
  textContent.value += '\n'
}

function handleMediaSelect(file: any) {
  mediaFile.value = file.raw
  mediaFileName.value = file.name
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

const maxFileSize: Record<string, number> = {
  image: 2 * 1024 * 1024,
  voice: 2 * 1024 * 1024,
  video: 10 * 1024 * 1024,
  file: 20 * 1024 * 1024,
}

function checkFileSize(file: File): boolean {
  const limit = maxFileSize[msgType.value] || 20 * 1024 * 1024
  if (file.size > limit) {
    const limitMB = limit / (1024 * 1024)
    ElMessage.warning(`文件大小超过限制（最大 ${limitMB}MB）`)
    return false
  }
  return true
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) {
    const file = input.files[0]
    if (!checkFileSize(file)) { input.value = ''; return }
    mediaFile.value = file
    mediaFileName.value = file.name
    uploadMedia()
  }
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) {
    if (!checkFileSize(file)) return
    mediaFile.value = file
    mediaFileName.value = file.name
    autoDetectMsgType(file)
    uploadMedia()
  }
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file') {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) return
      const detectedType = detectMediaType(file)
      if (!detectedType) {
        ElMessage.warning('不支持的文件类型')
        return
      }
      msgType.value = detectedType
      if (!checkFileSize(file)) return
      mediaFile.value = file
      mediaFileName.value = file.name || `paste_${Date.now()}.${getExt(file)}`
      uploadMedia()
      return
    }
  }
}

function detectMediaType(file: File): string | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'voice'
  if (file.type) return 'file'
  return 'file'
}

function getExt(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/gif') return 'gif'
  if (file.type.startsWith('video/')) return 'mp4'
  if (file.type.startsWith('audio/')) return 'amr'
  return 'bin'
}

function autoDetectMsgType(file: File) {
  const detected = detectMediaType(file)
  if (detected && ['image', 'voice', 'video', 'file'].includes(msgType.value)) {
    msgType.value = detected
  }
}

function clearMedia() {
  mediaFile.value = null
  mediaFileName.value = ''
  mediaId.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function uploadMedia() {
  if (!mediaFile.value) return
  uploading.value = true
  uploadProgress.value = 0
  try {
    const form = new FormData()
    form.append('media_type', msgType.value)
    form.append('file', mediaFile.value)
    form.append('filename', mediaFileName.value)

    const res: any = await api.upload('/upload_media', form, (percent) => {
      uploadProgress.value = percent
    })

    mediaId.value = res.media_id
    uploadProgress.value = 100
    ElMessage.success('上传成功')
  } catch (e: any) {
    ElMessage.error(e.message || '上传失败')
    clearMedia()
  } finally {
    uploading.value = false
  }
}

async function recallMsg(msgid: string) {
  try {
    await api.post('/kf/recall_msg', { msgid, open_kfid: current.value.open_kfid })
    ElMessage.success('撤回成功')
    await refreshMessages()
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

function openTrans() {
  if (!current.value) return
  transForm.value = { service_state: current.value.service_state || 0, servicer_userid: '' }
  transVisible.value = true
}

async function transState() {
  if (!current.value) return
  transLoading.value = true
  try {
    await api.post('/kf/service_state/trans', {
      open_kfid: current.value.open_kfid,
      external_userid: current.value.external_userid,
      service_state: transForm.value.service_state,
      servicer_userid: transForm.value.servicer_userid || undefined,
    })
    ElMessage.success('会话状态变更成功')
    transVisible.value = false
    current.value.service_state = transForm.value.service_state
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    transLoading.value = false
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadAccounts()
  loadSessions()
  pollTimer = setInterval(() => {
    if (current.value) {
      refreshMessages()
    }
  }, 30000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.session-panel {
  display: flex;
  height: 100%;
  gap: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
}

.session-list {
  width: 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.list-header .title { font-weight: 600; font-size: 14px; color: var(--text-primary); }

.list-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 4px;
}
.session-item:hover { background: var(--el-fill-color-light); }
.session-item.active { background: var(--el-color-primary-light-9); }

.session-info { flex: 1; min-width: 0; }
.session-user { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.session-kf { font-size: 11px; color: var(--el-text-color-secondary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--el-bg-color-page);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}
.chat-target .name { font-weight: 600; font-size: 14px; margin-right: 8px; }
.chat-actions { display: flex; gap: 8px; }

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #ebebeb;
}

.load-more-tip {
  text-align: center;
  font-size: 12px;
  color: #999;
  padding: 8px 0;
}
.load-more-tip.clickable { cursor: pointer; }
.load-more-tip.clickable:hover { color: var(--el-color-primary); }

.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  animation: msgIn 0.25s ease;
}
.msg-row.incoming { justify-content: flex-start; }
.msg-row.outgoing { justify-content: flex-end; }

@keyframes msgIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.msg-avatar {
  flex-shrink: 0;
}
.msg-avatar .el-avatar {
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.msg-bubble-wrap {
  max-width: 65%;
  position: relative;
}

.msg-bubble {
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  position: relative;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

/* Incoming: white bubble with left arrow */
.incoming .msg-bubble {
  background: #fff;
  border: none;
  color: #111;
}
.incoming .msg-bubble::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 12px;
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid #fff;
}

/* Outgoing: green bubble with right arrow */
.outgoing .msg-bubble {
  background: #95ec69;
  color: #191919;
}
.outgoing .msg-bubble::before {
  content: '';
  position: absolute;
  right: -6px;
  top: 12px;
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 6px solid #95ec69;
}

.msg-bubble:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 0 2px;
}
.incoming .msg-meta { justify-content: flex-start; }
.outgoing .msg-meta { justify-content: flex-end; }
.msg-time { font-size: 11px; color: #999; }

.chat-input {
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  padding: 0;
}

/* Composer Toolbar */
.composer-toolbar {
  display: flex;
  gap: 2px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  overflow-x: auto;
}
.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 15px;
  opacity: 0.6;
}
.tool-btn:hover { background: var(--el-fill-color-light); opacity: 1; }
.tool-btn.active {
  background: #07C160;
  color: #fff;
  opacity: 1;
}

/* Composer Body */
.composer-body { padding: 12px 16px; }

/* Text Compose */
.text-compose {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.text-compose textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.5;
  font-family: inherit;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  outline: none;
  transition: border-color 0.2s;
}
.text-compose textarea:focus {
  border-color: var(--el-color-primary);
}

/* Send Button */
.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #07C160;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { transform: scale(1.08); box-shadow: 0 2px 8px rgba(7,193,96,0.4); }
.send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* Media Compose */
.media-compose {
  border: 2px dashed var(--el-border-color-light);
  border-radius: 10px;
  transition: all 0.2s;
  overflow: hidden;
}
.media-compose.dragging {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.media-compose.has-file {
  border-style: solid;
  border-color: var(--el-border-color-lighter);
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  cursor: pointer;
  gap: 6px;
}
.drop-zone:hover { background: var(--el-fill-color-extra-light); }
.drop-icon { opacity: 0.5; color: var(--el-text-color-secondary); }
.drop-text { font-size: 13px; color: var(--el-text-color-regular); }
.drop-hint { font-size: 11px; color: var(--el-text-color-placeholder); }

.file-preview { padding: 14px 16px; }
.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.file-icon { font-size: 20px; }
.file-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-remove {
  border: none;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  border-radius: 4px;
}
.file-remove:hover { color: var(--el-color-danger); background: var(--el-color-danger-light-9); }

.upload-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--el-fill-color-light);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #07C160;
  border-radius: 2px;
  transition: width 0.2s;
}
.progress-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  min-width: 32px;
  text-align: right;
}

.upload-status.done {
  font-size: 12px;
  color: var(--el-color-success);
}

.file-ready {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--el-color-success);
}
.ready-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-success);
  animation: pulse-dot 1.5s infinite;
}

.media-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
  margin-top: 10px;
}

.action-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.action-btn:hover:not(:disabled) { border-color: var(--el-color-primary); color: var(--el-color-primary); }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Form Compose */
.form-compose {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-row {
  display: flex;
  gap: 8px;
}
.form-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  font-size: 13px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  outline: none;
  transition: border-color 0.2s;
}
.form-input:focus { border-color: var(--el-color-primary); }
.form-input.sm { max-width: 100px; }
.form-input::placeholder { color: var(--el-text-color-placeholder); }

.form-select {
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  font-size: 12px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  outline: none;
  cursor: pointer;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

/* Menu Items */
.menu-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--el-border-color-extra-light);
  border-radius: 6px;
}
.menu-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.menu-del {
  border: none;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 4px;
}
.menu-del:hover { color: var(--el-color-danger); }
.menu-add {
  border: 1px dashed var(--el-border-color-light);
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.15s;
}
.menu-add:hover { border-color: var(--el-color-primary); color: var(--el-color-primary); }

/* Spinner */
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.chat-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }
:deep(.media-tag) { color: #666; font-style: italic; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; }
:deep(.sys-event) { color: #999; font-size: 12px; text-align: center; display: block; }
:deep(.inline-icon) { width: 16px; height: 16px; vertical-align: middle; fill: currentColor; flex-shrink: 0; }
:deep(.file-icon-svg) { width: 32px; height: 32px; flex-shrink: 0; }

/* Image */
:deep(.msg-img) {
  max-width: 220px;
  max-height: 220px;
  border-radius: 4px;
  cursor: pointer;
  display: block;
  object-fit: cover;
}
:deep(.msg-img:hover) { opacity: 0.9; }

/* Voice */
:deep(.msg-voice) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}
:deep(.msg-voice .voice-icon) { font-size: 18px; }
:deep(.msg-voice .voice-dur) { font-size: 12px; color: #666; white-space: nowrap; }
:deep(.msg-voice audio) { height: 28px; max-width: 180px; }

/* Video */
:deep(.msg-video) {
  max-width: 260px;
  max-height: 200px;
  border-radius: 4px;
  display: block;
}

/* File */
:deep(.msg-file) {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #f7f7f7;
  border-radius: 4px;
  text-decoration: none;
  color: #333;
  min-width: 180px;
  border: 1px solid #e8e8e8;
}
:deep(.msg-file:hover) { background: #f0f0f0; }
:deep(.msg-file .file-info) { display: flex; flex-direction: column; overflow: hidden; }
:deep(.msg-file .file-name) {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
:deep(.msg-file .file-size) { font-size: 11px; color: #999; margin-top: 2px; }

/* Link card */
:deep(.msg-link-card) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #f7f7f7;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  text-decoration: none;
  color: #333;
  max-width: 240px;
}
:deep(.msg-link-card:hover) { background: #f0f0f0; }
:deep(.msg-link-card .link-title) { font-size: 14px; font-weight: 500; line-height: 1.4; }
:deep(.msg-link-card .link-desc) { font-size: 12px; color: #999; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Location */
:deep(.msg-location) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
:deep(.msg-location .loc-icon) { width: 22px; height: 22px; flex-shrink: 0; }
:deep(.msg-location .loc-info) { display: flex; flex-direction: column; gap: 2px; }
:deep(.msg-location .loc-name) { font-size: 13px; font-weight: 500; }
:deep(.msg-location .loc-addr) { font-size: 12px; color: #999; }

/* Menu message */
:deep(.menu-head) { font-size: 13px; margin-bottom: 6px; }
:deep(.menu-list) { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
:deep(.menu-item) {
  display: inline-block;
  padding: 4px 10px;
  background: #f0f0f0;
  border-radius: 12px;
  font-size: 12px;
  color: #07C160;
  border: 1px solid #e0e0e0;
}
:deep(.menu-tail) { font-size: 12px; color: #999; margin-top: 4px; }
</style>
