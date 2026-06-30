<template>
  <div v-if="!authenticated" class="login-gate">
    <div class="login-terminal">
      <div class="terminal-header">
        <span class="terminal-dot red"></span>
        <span class="terminal-dot yellow"></span>
        <span class="terminal-dot green"></span>
        <span class="terminal-title">wxkf-console</span>
      </div>
      <div class="terminal-body">
        <div class="terminal-line"><span class="prompt">$</span> connecting to wecom-kf-service...</div>
        <div class="terminal-line"><span class="prompt">$</span> authentication required</div>
        <form @submit.prevent="handleLogin" class="terminal-form">
          <div class="input-line">
            <span class="prompt">key:</span>
            <input v-model="keyInput" type="password" placeholder="enter admin key" class="terminal-input" autofocus />
          </div>
          <button type="submit" class="terminal-btn" :disabled="checking">
            <span v-if="checking" class="spinner"></span>
            <span v-else>▶ AUTHENTICATE</span>
          </button>
        </form>
        <div v-if="loginError" class="terminal-error">✗ {{ loginError }}</div>
      </div>
    </div>
  </div>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-dot"></div>
        <span>WXKF</span>
      </div>
      <nav class="sidebar-nav">
        <button v-for="item in menuItems" :key="item.key" :class="['nav-item', { active: activeMenu === item.key }]" @click="activeMenu = item.key">
          <el-icon :size="16"><component :is="item.icon" /></el-icon>
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <button class="nav-item logout" @click="handleLogout">
          <el-icon :size="16"><SwitchButton /></el-icon>
          <span class="nav-label">退出</span>
        </button>
      </div>
    </aside>
    <main class="main-area">
      <header class="main-header">
        <h1>{{ pageTitle }}</h1>
        <div class="header-status"><span class="status-dot"></span><span>connected</span></div>
      </header>
      <div class="main-content">
        <transition name="slide" mode="out-in">
          <AccountPanel v-if="activeMenu === 'accounts'" />
          <SessionPanel v-else-if="activeMenu === 'sessions'" />
          <MessagePanel v-else-if="activeMenu === 'messages'" />
          <StatisticsPanel v-else-if="activeMenu === 'statistics'" />
          <SettingsPanel v-else-if="activeMenu === 'settings'" />
          <DebugPanel v-else-if="activeMenu === 'debug'" />
        </transition>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getAdminKey, setAdminKey, api } from './api'
import AccountPanel from './panels/AccountPanel.vue'
import SessionPanel from './panels/SessionPanel.vue'
import MessagePanel from './panels/MessagePanel.vue'
import StatisticsPanel from './panels/StatisticsPanel.vue'
import SettingsPanel from './panels/SettingsPanel.vue'
import DebugPanel from './panels/DebugPanel.vue'

const authenticated = ref(false)
const checking = ref(false)
const keyInput = ref('')
const loginError = ref('')
const activeMenu = ref('accounts')

const menuItems = [
  { key: 'accounts', label: '客服帐号', icon: 'User' },
  { key: 'sessions', label: '会话管理', icon: 'ChatDotRound' },
  { key: 'messages', label: '消息同步', icon: 'Message' },
  { key: 'statistics', label: '统计数据', icon: 'DataAnalysis' },
  { key: 'settings', label: '系统设置', icon: 'Setting' },
  { key: 'debug', label: 'Debug', icon: 'Monitor' },
]

const pageTitles: Record<string, string> = {
  accounts: '客服帐号管理',
  sessions: '会话管理',
  messages: '消息同步',
  statistics: '统计数据',
  settings: '系统设置',
  debug: 'Debug 日志',
}
const pageTitle = computed(() => pageTitles[activeMenu.value] || '')

async function verifyKey(): Promise<boolean> {
  try {
    await api.get('/kf/accounts')
    return true
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return false
    return true
  }
}

async function handleLogin() {
  checking.value = true
  loginError.value = ''
  setAdminKey(keyInput.value)
  const ok = await verifyKey()
  checking.value = false
  if (ok) {
    authenticated.value = true
  } else {
    loginError.value = 'invalid key'
    setAdminKey('')
  }
}

function handleLogout() {
  setAdminKey('')
  authenticated.value = false
  keyInput.value = ''
}

onMounted(async () => {
  if (getAdminKey()) {
    const ok = await verifyKey()
    if (ok) authenticated.value = true
  }
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap');

:root {
  --bg-root: #ededed;
  --bg-surface: #ffffff;
  --bg-elevated: #f7f7f7;
  --bg-hover: #ececec;
  --border: #e0e0e0;
  --border-active: #d0d0d0;
  --text-primary: #191919;
  --text-secondary: #666666;
  --text-muted: #999999;
  --accent: #07C160;
  --accent-dim: rgba(7, 193, 96, 0.1);
  --accent-glow: rgba(7, 193, 96, 0.25);
  --danger: #fa5151;
  --warning: #f0a000;
  --info: #1989fa;
  --radius: 6px;
  --radius-lg: 10px;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-sans: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  --shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; background: var(--bg-root); color: var(--text-primary); font-family: var(--font-sans); font-size: 14px; line-height: 1.5; }
#app { height: 100%; }

:root {
  --el-color-primary: #07C160;
  --el-color-primary-light-1: #20c76f;
  --el-color-primary-light-2: #39cd7f;
  --el-color-primary-light-3: #51d48f;
  --el-color-primary-light-4: #6ada9f;
  --el-color-primary-light-5: #83e0b0;
  --el-color-primary-light-6: #9ce6c0;
  --el-color-primary-light-7: #b5ecd0;
  --el-color-primary-light-8: #cdf3df;
  --el-color-primary-light-9: #e6f9ef;
  --el-color-primary-dark-2: #06ad56;
}

/* Element Plus WeChat Theme Override */
.el-table { --el-table-bg-color: var(--bg-surface); --el-table-tr-bg-color: var(--bg-surface); --el-table-header-bg-color: var(--bg-elevated); --el-table-row-hover-bg-color: var(--bg-hover); --el-table-border-color: var(--border); --el-table-text-color: var(--text-primary); --el-table-header-text-color: var(--text-secondary); }
.el-card { --el-card-bg-color: var(--bg-surface); --el-card-border-color: var(--border); color: var(--text-primary); }
.el-dialog { --el-dialog-bg-color: var(--bg-surface); --el-dialog-border-radius: var(--radius-lg); }
.el-input__wrapper { background: var(--bg-surface) !important; box-shadow: 0 0 0 1px var(--border) inset !important; }
.el-input__inner { color: var(--text-primary) !important; }
.el-select-dropdown { background: var(--bg-surface) !important; border-color: var(--border) !important; }
.el-form-item__label { color: var(--text-secondary) !important; }
.el-button--primary { --el-button-bg-color: var(--accent); --el-button-border-color: var(--accent); --el-button-text-color: #fff; --el-button-hover-bg-color: #06ad56; --el-button-hover-border-color: #06ad56; }
.el-tag { --el-tag-bg-color: var(--accent-dim); --el-tag-border-color: transparent; --el-tag-text-color: var(--accent); }
.el-tag--danger { --el-tag-bg-color: rgba(250, 81, 81, 0.1); --el-tag-text-color: var(--danger); }
.el-tag--warning { --el-tag-bg-color: rgba(240, 160, 0, 0.1); --el-tag-text-color: var(--warning); }
.el-tag--info { --el-tag-bg-color: rgba(25, 137, 250, 0.1); --el-tag-text-color: var(--info); }
.el-tag--success { --el-tag-bg-color: var(--accent-dim); --el-tag-text-color: var(--accent); }
.el-descriptions { --el-descriptions-item-bordered-label-background: var(--bg-elevated); }
.el-empty__description p { color: var(--text-muted) !important; }
.el-message-box { --el-messagebox-title-color: var(--text-primary); background: var(--bg-surface) !important; border-color: var(--border) !important; }
.el-overlay-dialog .el-dialog__header { border-bottom: 1px solid var(--border); }
.el-overlay-dialog .el-dialog__title { color: var(--text-primary); }
.el-overlay-dialog .el-dialog__body { color: var(--text-primary); }

/* Login Gate */
.login-gate {
  height: 100vh; display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated);
  background-image: radial-gradient(ellipse at 50% 0%, rgba(7, 193, 96, 0.06) 0%, transparent 60%);
}
.login-terminal {
  width: 460px; border-radius: var(--radius-lg); overflow: hidden;
  border: 1px solid var(--border); box-shadow: var(--shadow);
  background: var(--bg-surface);
  animation: fadeUp 0.4s ease;
}
.terminal-header {
  background: var(--bg-elevated); padding: 12px 16px;
  display: flex; align-items: center; gap: 8px;
  border-bottom: 1px solid var(--border);
}
.terminal-dot { width: 10px; height: 10px; border-radius: 50%; }
.terminal-dot.red { background: #ff5f57; }
.terminal-dot.yellow { background: #febc2e; }
.terminal-dot.green { background: #28c840; }
.terminal-title { margin-left: 12px; font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }
.terminal-body { background: var(--bg-surface); padding: 24px; }
.terminal-line { font-family: var(--font-mono); font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.prompt { color: var(--accent); margin-right: 8px; }
.terminal-form { margin-top: 20px; }
.input-line { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-family: var(--font-mono); font-size: 13px; color: var(--accent); }
.terminal-input {
  flex: 1; background: transparent; border: none; border-bottom: 1px solid var(--border);
  color: var(--text-primary); font-family: var(--font-mono); font-size: 13px;
  padding: 4px 0; outline: none; transition: border-color 0.2s;
}
.terminal-input:focus { border-color: var(--accent); }
.terminal-input::placeholder { color: var(--text-muted); }
.terminal-btn {
  width: 100%; padding: 10px; border: 1px solid var(--accent); border-radius: var(--radius);
  background: var(--accent-dim); color: var(--accent);
  font-family: var(--font-mono); font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.2s;
}
.terminal-btn:hover:not(:disabled) { background: var(--accent); color: var(--bg-root); }
.terminal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.terminal-error { margin-top: 12px; font-family: var(--font-mono); font-size: 12px; color: var(--danger); }
.spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--accent-dim); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }

/* App Shell */
.app-shell { display: flex; height: 100vh; }
.sidebar {
  width: 200px; background: var(--bg-surface); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; flex-shrink: 0;
}
.sidebar-brand {
  padding: 16px; display: flex; align-items: center; gap: 10px;
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono); font-weight: 700; font-size: 16px; letter-spacing: 2px;
}
.brand-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent-glow); }
.sidebar-nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; }
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius);
  border: none; background: transparent; color: var(--text-secondary);
  font-family: var(--font-sans); font-size: 13px; cursor: pointer; transition: all 0.15s; width: 100%; text-align: left;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.nav-item.active { background: var(--accent-dim); color: var(--accent); }
.nav-item .el-icon { color: inherit; }
.sidebar-footer { padding: 12px 8px; border-top: 1px solid var(--border); }
.nav-item.logout:hover { color: var(--danger); }

/* Main */
.main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.main-header {
  padding: 16px 28px; border-bottom: 1px solid var(--border); background: var(--bg-surface);
  display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
}
.main-header h1 { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.header-status { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 2s infinite; }
.main-content { flex: 1; padding: 24px 28px; overflow-y: auto; }

/* Transitions */
.slide-enter-active, .slide-leave-active { transition: all 0.2s ease; }
.slide-enter-from { opacity: 0; transform: translateY(8px); }
.slide-leave-to { opacity: 0; transform: translateY(-4px); }

@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
