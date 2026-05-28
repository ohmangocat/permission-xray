<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useMessage } from '@/hooks/useMessage.ts'
import {
  checkPermission,
  getPermissionXrayState,
  inspectPermissionXrayElement,
  setPermissionXrayInspectorActive,
  setPermissionXrayHighlight,
  togglePermissionXrayInspector,
  type PermissionKind,
} from '../utils/permission-xray'

defineOptions({ name: 'PermissionXrayToolbar' })

interface RoutePermissionItem {
  kind: PermissionKind
  label: string
  values: string[]
  allowed: boolean
}

type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

const route = useRoute()
const userStore = useUserStore()
const message = useMessage()
const state = getPermissionXrayState()

const kindMap: Record<PermissionKind, { label: string, color: TagType }> = {
  auth: { label: '权限码', color: 'primary' },
  role: { label: '角色', color: 'success' },
  user: { label: '用户', color: 'warning' },
}

const routePermissions = computed<RoutePermissionItem[]>(() => {
  const meta = route.meta ?? {}
  return ([
    { kind: 'auth', label: '路由权限码', values: normalizeValues(meta.auth), allowed: checkPermission('auth', normalizeValues(meta.auth)) },
    { kind: 'role', label: '路由角色', values: normalizeValues(meta.role), allowed: checkPermission('role', normalizeValues(meta.role)) },
    { kind: 'user', label: '路由用户', values: normalizeValues(meta.user), allowed: checkPermission('user', normalizeValues(meta.user)) },
  ] as RoutePermissionItem[]).filter(item => item.values.length > 0)
})

const userInfo = computed(() => userStore.getUserInfo?.() ?? {})
const roles = computed<string[]>(() => userStore.getRoles?.() ?? [])
const permissions = computed<string[]>(() => userStore.getPermissions?.() ?? [])
const isSuper = computed(() => roles.value.includes('SuperAdmin') || permissions.value[0] === '*')
const blockedCount = computed(() => state.records.filter(item => !item.allowed || item.removed).length)
const routeBlockedCount = computed(() => routePermissions.value.filter(item => !item.allowed).length)
const triggerTone = computed(() => state.inspectorActive ? 'active' : blockedCount.value + routeBlockedCount.value > 0 ? 'danger' : 'success')
const hoverStyle = computed(() => {
  const hover = state.hover
  if (!hover) {
    return {}
  }

  const offset = 18
  const width = 330
  const left = Math.min(hover.x + offset, window.innerWidth - width - 12)
  const top = Math.min(hover.y + offset, window.innerHeight - 230)
  return {
    left: `${Math.max(12, left)}px`,
    top: `${Math.max(12, top)}px`,
  }
})

function normalizeValues(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : []
}

function kindLabel(kind: PermissionKind) {
  return kindMap[kind].label
}

function kindColor(kind: PermissionKind): TagType {
  return kindMap[kind].color
}

function handlePointerMove(event: Event) {
  if (!(event instanceof PointerEvent)) {
    return
  }
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }
  if (target.closest('.permission-xray-trigger, .permission-xray-float, .permission-xray-status')) {
    return
  }
  inspectPermissionXrayElement(target, event.clientX, event.clientY)
}

function blockPageAction(event: Event) {
  const target = event.target
  if (target instanceof HTMLElement && target.closest('.permission-xray-trigger, .permission-xray-float, .permission-xray-status')) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
}

function handleKeydown(event: Event) {
  if (!(event instanceof KeyboardEvent)) {
    return
  }
  if (event.key === 'Escape') {
    setPermissionXrayInspectorActive(false)
  }
}

function toggleInspector(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  togglePermissionXrayInspector()
  message[state.inspectorActive ? 'success' : 'info'](state.inspectorActive ? '权限透视已开启' : '权限透视已关闭')
}

function locateHoverElement() {
  if (!state.hover?.elementId) {
    return
  }
  setPermissionXrayHighlight(state.hover.elementId)
}

async function copyHoverCodes() {
  const values = state.hover?.records.flatMap(item => item.values) ?? []
  if (values.length === 0) {
    return
  }
  await navigator.clipboard.writeText([...new Set(values)].join(', '))
  message.success('已复制')
}

watch(() => state.inspectorActive, (active) => {
  const method = active ? 'addEventListener' : 'removeEventListener'
  document[method]('pointermove', handlePointerMove, true)
  document[method]('click', blockPageAction, true)
  document[method]('dblclick', blockPageAction, true)
  document[method]('contextmenu', blockPageAction, true)
  document[method]('keydown', handleKeydown, true)
})

onBeforeUnmount(() => {
  setPermissionXrayInspectorActive(false)
  document.removeEventListener('pointermove', handlePointerMove, true)
  document.removeEventListener('click', blockPageAction, true)
  document.removeEventListener('dblclick', blockPageAction, true)
  document.removeEventListener('contextmenu', blockPageAction, true)
  document.removeEventListener('keydown', handleKeydown, true)
})
</script>

<template>
  <button class="permission-xray-trigger" :class="`is-${triggerTone}`" type="button" aria-label="权限透视" @click="toggleInspector">
    <ma-svg-icon name="material-symbols:policy-rounded" size="18" />
    <span>{{ state.inspectorActive ? '关闭透视' : '权限透视' }}</span>
    <b>{{ blockedCount + routeBlockedCount }}</b>
  </button>

  <teleport to="body">
    <div v-if="state.inspectorActive" class="permission-xray-status">
      <ma-svg-icon name="material-symbols:policy-rounded" size="18" />
      <span>权限透视中，点击被锁定，按 Esc 退出</span>
    </div>

    <div v-if="state.inspectorActive && state.hover" class="permission-xray-float" :style="hoverStyle">
      <header class="float-header">
        <div>
          <strong>{{ state.hover.text || state.hover.tag }}</strong>
          <span>{{ state.hover.path || state.hover.tag }}</span>
        </div>
        <el-tag v-if="state.hover.hasPermission" size="small" :type="state.hover.allowed ? 'success' : 'danger'" effect="plain">
          {{ state.hover.allowed ? '通过' : '阻断' }}
        </el-tag>
        <el-tag v-else size="small" type="info" effect="plain">
          无权限声明
        </el-tag>
      </header>

      <div v-if="state.hover.records.length > 0" class="float-records">
        <div v-for="record in state.hover.records" :key="record.id" class="float-record">
          <div class="record-title">
            <el-tag size="small" :type="kindColor(record.kind)" effect="plain">
              {{ kindLabel(record.kind) }}
            </el-tag>
            <span :class="record.allowed && !record.removed ? 'status-pass' : 'status-block'">
              {{ record.removed ? '已移除' : record.allowed ? '通过' : '未命中' }}
            </span>
          </div>
          <code>{{ record.values.join(', ') }}</code>
        </div>
      </div>

      <div v-else class="float-empty">
        当前 DOM 没有 `v-auth / v-role / v-user`
      </div>

      <section class="float-route">
        <div class="mini-title">
          当前路由
        </div>
        <template v-if="routePermissions.length > 0">
          <div v-for="item in routePermissions" :key="item.kind" class="route-line">
            <span>{{ item.label }}</span>
            <code>{{ item.values.join(', ') }}</code>
            <b :class="item.allowed ? 'status-pass' : 'status-block'">{{ item.allowed ? '通过' : '未命中' }}</b>
          </div>
        </template>
        <div v-else class="route-line is-empty">
          未声明路由权限
        </div>
      </section>

      <footer class="float-footer">
        <span>{{ isSuper ? '超管/通配' : userInfo?.username || '当前用户' }}</span>
        <button type="button" :disabled="!state.hover.elementId" @click="locateHoverElement">
          定位
        </button>
        <button type="button" :disabled="state.hover.records.length === 0" @click="copyHoverCodes">
          复制
        </button>
      </footer>
    </div>
  </teleport>
</template>

<style scoped>
.permission-xray-trigger {
  height: 32px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 0 9px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}

.permission-xray-trigger:hover,
.permission-xray-trigger.is-success:hover {
  border-color: var(--el-color-success);
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.permission-xray-trigger.is-danger {
  border-color: var(--el-color-danger-light-5);
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.permission-xray-trigger.is-active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.permission-xray-trigger span {
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
}

.permission-xray-trigger b {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: currentColor;
  color: var(--el-bg-color);
  font-size: 11px;
  line-height: 1;
}

.permission-xray-status {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 5000;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 6px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--el-bg-color);
  color: var(--el-color-primary);
  box-shadow: var(--el-box-shadow-light);
  font-size: 13px;
  pointer-events: auto;
}

.permission-xray-float {
  position: fixed;
  z-index: 5001;
  width: 330px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 12px;
  background: var(--el-bg-color);
  box-shadow: var(--el-box-shadow-dark);
  pointer-events: auto;
}

.float-header,
.record-title,
.float-footer,
.route-line {
  display: flex;
  align-items: center;
}

.float-header,
.float-footer {
  justify-content: space-between;
  gap: 10px;
}

.float-header > div {
  min-width: 0;
}

.float-header strong,
.float-header span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.float-header strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.float-header span {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.float-records {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.float-record {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 8px;
  background: var(--el-fill-color-extra-light);
}

.record-title {
  justify-content: space-between;
  gap: 8px;
}

.float-record code,
.route-line code {
  overflow: hidden;
  color: var(--el-text-color-regular);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.float-record code {
  margin-top: 7px;
  display: block;
}

.float-empty {
  margin-top: 10px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  padding: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.float-route {
  margin-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 10px;
}

.mini-title {
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 700;
}

.route-line {
  min-width: 0;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.route-line + .route-line {
  margin-top: 5px;
}

.route-line span {
  flex: none;
}

.route-line code {
  flex: 1;
}

.route-line b {
  flex: none;
}

.route-line.is-empty {
  color: var(--el-text-color-placeholder);
}

.float-footer {
  margin-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 10px;
}

.float-footer span {
  min-width: 0;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.float-footer button {
  border: 1px solid var(--el-border-color-light);
  border-radius: 5px;
  padding: 4px 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  cursor: pointer;
  font-size: 12px;
}

.float-footer button:disabled {
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
}

.status-pass,
.status-block {
  flex: none;
  font-size: 12px;
  font-weight: 700;
}

.status-pass {
  color: var(--el-color-success);
}

.status-block {
  color: var(--el-color-danger);
}

:global(.permission-xray-active *) {
  cursor: crosshair !important;
}

:global(.permission-xray-hover) {
  outline: 2px solid var(--el-color-primary) !important;
  outline-offset: 3px;
  box-shadow: 0 0 0 6px var(--el-color-primary-light-8) !important;
}

:global(.permission-xray-highlight) {
  outline: 2px solid var(--el-color-warning) !important;
  outline-offset: 3px;
  box-shadow: 0 0 0 6px var(--el-color-warning-light-8) !important;
}

@media (max-width: 1024px) {
  .permission-xray-trigger {
    width: 32px;
    justify-content: center;
    padding: 0;
  }

  .permission-xray-trigger span,
  .permission-xray-trigger b {
    display: none;
  }

  .permission-xray-float {
    width: min(330px, calc(100vw - 24px));
  }
}
</style>
