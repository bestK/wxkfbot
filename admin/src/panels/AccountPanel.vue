<template>
  <div class="panel">
    <div class="panel-toolbar">
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon> 添加客服帐号
      </el-button>
      <el-button @click="loadAccounts" :loading="loading" circle>
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <el-card shadow="never" class="panel-card">
      <el-table :data="accounts" v-loading="loading">
        <el-table-column prop="open_kfid" label="客服ID" width="280">
          <template #default="{ row }">
            <el-text type="info" size="small" class="mono">{{ row.open_kfid }}</el-text>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称">
          <template #default="{ row }">
            <div class="account-cell">
              <el-avatar :src="row.avatar" v-if="row.avatar" :size="32" />
              <el-avatar v-else :size="32" style="background:#07C160">{{ row.name?.[0] || '?' }}</el-avatar>
              <span class="account-name">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" align="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button size="small" @click="openEdit(row)">
                <el-icon><Edit /></el-icon> 编辑
              </el-button>
              <el-button size="small" @click="getLink(row)">
                <el-icon><Link /></el-icon> 链接
              </el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加对话框 -->
    <el-dialog v-model="showAddDialog" title="添加客服帐号" width="440px" destroy-on-close>
      <el-form :model="addForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="addForm.name" placeholder="客服帐号名称" maxlength="16" show-word-limit />
        </el-form-item>
        <el-form-item label="头像ID">
          <el-input v-model="addForm.media_id" placeholder="媒体文件media_id（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAdd" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑客服帐号" width="460px" destroy-on-close>
      <div class="profile-editor">
        <div class="avatar-section">
          <div class="avatar-frame" :class="{ ready: editForm.media_id }">
            <img
              v-if="editForm.avatarPreview || editForm.currentAvatar"
              :src="editForm.avatarPreview || editForm.currentAvatar"
              class="avatar-img"
            />
            <div v-else class="avatar-empty">
              <el-icon :size="28" color="#bbb"><User /></el-icon>
            </div>
            <button class="avatar-overlay" @click="triggerAvatarSelect" title="更换头像">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          </div>
          <div class="avatar-hint">
            <span v-if="editForm.media_id" class="hint-ready">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              头像已就绪
            </span>
            <span v-else class="hint-default">点击头像更换</span>
            <button v-if="editForm.avatarPreview" class="hint-remove" @click="clearAvatar">移除</button>
          </div>
        </div>

        <div class="field-section">
          <label class="field-label">客服名称</label>
          <el-input v-model="editForm.name" placeholder="输入新名称" maxlength="16" show-word-limit />
          <div class="field-note">客服ID: <code>{{ editForm.open_kfid }}</code></div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdate" :loading="submitting">保存</el-button>
      </template>

      <input ref="avatarInputRef" type="file" accept="image/png,image/jpeg" hidden @change="handleAvatarSelect" />
    </el-dialog>

    <!-- 头像裁切对话框 -->
    <el-dialog v-model="showCropDialog" title="裁切头像" width="500px" destroy-on-close @closed="destroyCropper">
      <div class="crop-container">
        <img ref="cropImgRef" :src="cropImgSrc" class="crop-image" />
      </div>
      <template #footer>
        <el-button @click="showCropDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmCrop" :loading="avatarUploading">确认裁切</el-button>
      </template>
    </el-dialog>

    <!-- 链接展示 -->
    <el-dialog v-model="showLinkDialog" title="客服链接" width="520px">
      <el-alert type="success" :closable="false" show-icon style="margin-bottom:12px">
        <template #title>客服链接已生成，复制后可分享给客户</template>
      </el-alert>
      <el-input :model-value="contactUrl" readonly>
        <template #append>
          <el-button @click="copyLink">
            <el-icon><CopyDocument /></el-icon> 复制
          </el-button>
        </template>
      </el-input>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'

const loading = ref(false)
const submitting = ref(false)
const accounts = ref<any[]>([])

const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showLinkDialog = ref(false)
const showCropDialog = ref(false)
const contactUrl = ref('')

const addForm = ref({ name: '', media_id: '' })
const editForm = ref({ open_kfid: '', name: '', media_id: '', currentAvatar: '', avatarPreview: '' })

const avatarInputRef = ref<HTMLInputElement>()
const cropImgRef = ref<HTMLImageElement>()
const cropImgSrc = ref('')
const avatarUploading = ref(false)
let cropper: Cropper | null = null

async function loadAccounts() {
  loading.value = true
  try {
    const res = await api.get('/kf/accounts')
    accounts.value = res?.account_list || []
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function handleAdd() {
  if (!addForm.value.name) return ElMessage.warning('请输入名称')
  submitting.value = true
  try {
    await api.post('/kf/account/add', {
      name: addForm.value.name,
      media_id: addForm.value.media_id || undefined,
    })
    ElMessage.success('添加成功')
    showAddDialog.value = false
    addForm.value = { name: '', media_id: '' }
    await loadAccounts()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    submitting.value = false
  }
}

function openEdit(row: any) {
  editForm.value = {
    open_kfid: row.open_kfid,
    name: row.name,
    media_id: '',
    currentAvatar: row.avatar || '',
    avatarPreview: '',
  }
  showEditDialog.value = true
}

function triggerAvatarSelect() {
  avatarInputRef.value?.click()
}

function handleAvatarSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 2MB')
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    cropImgSrc.value = ev.target?.result as string
    showCropDialog.value = true
    nextTick(() => initCropper())
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function initCropper() {
  if (!cropImgRef.value) return
  destroyCropper()
  cropper = new Cropper(cropImgRef.value, {
    aspectRatio: 1,
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.9,
    cropBoxResizable: true,
    cropBoxMovable: true,
    guides: true,
    center: true,
    background: true,
  })
}

function destroyCropper() {
  if (cropper) {
    cropper.destroy()
    cropper = null
  }
}

async function confirmCrop() {
  if (!cropper) return
  avatarUploading.value = true
  try {
    const canvas = cropper.getCroppedCanvas({
      width: 300,
      height: 300,
      imageSmoothingQuality: 'high',
    })
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('裁切失败')), 'image/png')
    })
    const form = new FormData()
    form.append('media_type', 'image')
    form.append('file', blob, 'avatar.png')
    form.append('filename', 'avatar.png')
    const res: any = await api.upload('/upload_media', form)
    editForm.value.media_id = res.media_id
    editForm.value.avatarPreview = canvas.toDataURL('image/png')
    showCropDialog.value = false
    ElMessage.success('头像上传成功')
  } catch (e: any) {
    ElMessage.error(e.message || '头像上传失败')
  } finally {
    avatarUploading.value = false
  }
}

function clearAvatar() {
  editForm.value.media_id = ''
  editForm.value.avatarPreview = ''
}

async function handleUpdate() {
  submitting.value = true
  try {
    await api.post('/kf/account/update', {
      open_kfid: editForm.value.open_kfid,
      name: editForm.value.name || undefined,
      media_id: editForm.value.media_id || undefined,
    })
    ElMessage.success('修改成功')
    showEditDialog.value = false
    await loadAccounts()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确认删除客服帐号「${row.name}」？此操作不可恢复。`, '删除确认', {
    type: 'warning', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger',
  })
  try {
    await api.post('/kf/account/delete', { open_kfid: row.open_kfid })
    ElMessage.success('删除成功')
    await loadAccounts()
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

async function getLink(row: any) {
  try {
    const res = await api.post('/kf/contact_way', { open_kfid: row.open_kfid, scene: '1' })
    contactUrl.value = res?.url || ''
    showLinkDialog.value = true
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

function copyLink() {
  navigator.clipboard.writeText(contactUrl.value)
  ElMessage.success('已复制到剪贴板')
}

onMounted(loadAccounts)
</script>

<style scoped>
.panel-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.panel-card { border-radius: var(--card-radius, 8px); }
.account-cell { display: flex; align-items: center; gap: 10px; }
.account-name { font-weight: 500; }
.mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 12px; }

/* Profile Editor */
.profile-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 8px 0;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.avatar-frame {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 2.5px solid var(--border, #e0e0e0);
  overflow: hidden;
  transition: border-color 0.3s;
}
.avatar-frame.ready {
  border-color: var(--accent, #07C160);
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated, #f7f7f7);
}
.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s;
  border: none;
  cursor: pointer;
}
.avatar-frame:hover .avatar-overlay {
  opacity: 1;
}

.avatar-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.hint-ready {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--accent, #07C160);
  font-weight: 500;
}
.hint-default {
  color: var(--text-muted, #999);
}
.hint-remove {
  background: none;
  border: none;
  color: var(--danger, #fa5151);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}
.hint-remove:hover {
  text-decoration: underline;
}

.field-section {
  width: 100%;
}
.field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
}
.field-note {
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted, #999);
}
.field-note code {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  background: var(--bg-elevated, #f7f7f7);
  padding: 2px 6px;
  border-radius: 3px;
}

/* Crop */
.crop-container {
  width: 100%;
  height: 350px;
  background: #f0f0f0;
  border-radius: var(--radius, 6px);
  overflow: hidden;
}
.crop-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
}
</style>
