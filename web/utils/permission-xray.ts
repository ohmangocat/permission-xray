import type { Directive, DirectiveBinding } from 'vue'
import { reactive } from 'vue'
import hasAuth from '@/utils/permission/hasAuth'
import hasRole from '@/utils/permission/hasRole'
import hasUser from '@/utils/permission/hasUser'

export type PermissionKind = 'auth' | 'role' | 'user'

export interface PermissionRecord {
  id: string
  elementId: string
  kind: PermissionKind
  values: string[]
  allowed: boolean
  text: string
  tag: string
  className: string
  path: string
  removed: boolean
  updatedAt: number
}

export interface PermissionHoverSnapshot {
  elementId: string
  hasPermission: boolean
  records: PermissionRecord[]
  text: string
  tag: string
  className: string
  path: string
  x: number
  y: number
  allowed: boolean | null
}

export interface PermissionXrayState {
  records: PermissionRecord[]
  highlightId: string
  inspectorActive: boolean
  hover: PermissionHoverSnapshot | null
}

type PermissionDirective = Directive<HTMLElement, string | string[]>

const elementIds = new WeakMap<HTMLElement, string>()
const state = reactive<PermissionXrayState>({
  records: [],
  highlightId: '',
  inspectorActive: false,
  hover: null,
})

let seed = 0
let hoverElement: HTMLElement | null = null

function normalizeValues(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean)
  }
  return value ? [String(value).trim()].filter(Boolean) : []
}

export function checkPermission(kind: PermissionKind, values: string[]): boolean {
  if (values.length === 0) {
    return false
  }

  if (kind === 'auth') {
    return hasAuth(values)
  }
  if (kind === 'role') {
    return hasRole(values)
  }
  return hasUser(values)
}

function getElementId(el: HTMLElement): string {
  const currentId = elementIds.get(el)
  if (currentId) {
    return currentId
  }

  seed += 1
  const id = `permission-xray-${seed}`
  elementIds.set(el, id)
  el.dataset.permissionXrayId = id
  return id
}

function getElementPath(el: HTMLElement): string {
  const path: string[] = []
  let current: HTMLElement | null = el
  while (current && current !== document.body && path.length < 5) {
    const tag = current.tagName.toLowerCase()
    const className = Array.from(current.classList).slice(0, 2).map(item => `.${item}`).join('')
    path.unshift(`${tag}${className}`)
    current = current.parentElement
  }
  return path.join(' > ')
}

function getElementText(el: HTMLElement): string {
  return (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function upsertRecord(el: HTMLElement, kind: PermissionKind, binding: DirectiveBinding<string | string[]>, removed: boolean) {
  const values = normalizeValues(binding.value)
  const elementId = getElementId(el)
  const record: PermissionRecord = {
    id: `${elementId}-${kind}`,
    elementId,
    kind,
    values,
    allowed: checkPermission(kind, values),
    text: getElementText(el),
    tag: el.tagName.toLowerCase(),
    className: el.className ? String(el.className).slice(0, 120) : '',
    path: getElementPath(el),
    removed,
    updatedAt: Date.now(),
  }
  const index = state.records.findIndex(item => item.id === record.id)
  if (index >= 0) {
    state.records[index] = record
  }
  else {
    state.records.unshift(record)
  }
}

function removeRecord(el: HTMLElement, kind: PermissionKind) {
  const elementId = elementIds.get(el)
  if (!elementId) {
    return
  }

  const index = state.records.findIndex(item => item.id === `${elementId}-${kind}`)
  if (index >= 0) {
    state.records.splice(index, 1)
  }
}

function callDirectiveHook(directive: Directive | undefined, name: 'mounted' | 'updated' | 'unmounted', args: any[]) {
  if (!directive) {
    return
  }
  if (typeof directive === 'function') {
    if (name !== 'unmounted') {
      Reflect.apply(directive, undefined, args)
    }
    return
  }

  const hook = directive[name]
  if (typeof hook === 'function') {
    Reflect.apply(hook, undefined, args)
  }
}

function wrapDirective(kind: PermissionKind, original: Directive | undefined): PermissionDirective {
  if ((original as PermissionDirective & { __permissionXrayWrapped?: boolean } | undefined)?.__permissionXrayWrapped) {
    return original as PermissionDirective
  }

  const wrapped = {
    mounted(el, binding, vnode, prevVnode) {
      upsertRecord(el, kind, binding, false)
      callDirectiveHook(original, 'mounted', [el, binding, vnode, prevVnode])
      if (!el.isConnected) {
        upsertRecord(el, kind, binding, true)
      }
    },
    updated(el, binding, vnode, prevVnode) {
      upsertRecord(el, kind, binding, false)
      callDirectiveHook(original, 'updated', [el, binding, vnode, prevVnode])
      if (!el.isConnected) {
        upsertRecord(el, kind, binding, true)
      }
    },
    unmounted(el, binding, vnode, prevVnode) {
      callDirectiveHook(original, 'unmounted', [el, binding, vnode, prevVnode])
      removeRecord(el, kind)
    },
  } as PermissionDirective & { __permissionXrayWrapped?: boolean }
  wrapped.__permissionXrayWrapped = true
  return wrapped
}

function recordsByElementId(elementId: string): PermissionRecord[] {
  return state.records.filter(item => item.elementId === elementId)
}

function findPermissionHost(el: HTMLElement): { element: HTMLElement, records: PermissionRecord[] } {
  let current: HTMLElement | null = el
  while (current && current !== document.body) {
    const elementId = current.dataset.permissionXrayId
    const records = elementId ? recordsByElementId(elementId) : []
    if (records.length > 0) {
      return { element: current, records }
    }
    current = current.parentElement
  }
  return { element: el, records: [] }
}

function clearHoverElement() {
  hoverElement?.classList.remove('permission-xray-hover')
  hoverElement = null
}

export function registerPermissionXrayDirectives(app: any) {
  const auth = app.directive('auth')
  const role = app.directive('role')
  const user = app.directive('user')

  app.directive('auth', wrapDirective('auth', auth))
  app.directive('role', wrapDirective('role', role))
  app.directive('user', wrapDirective('user', user))
}

export function getPermissionXrayState() {
  return state
}

export function setPermissionXrayInspectorActive(active: boolean) {
  state.inspectorActive = active
  document.documentElement.classList.toggle('permission-xray-active', active)
  if (!active) {
    clearHoverElement()
    clearPermissionXrayHighlight()
    state.hover = null
  }
}

export function togglePermissionXrayInspector() {
  setPermissionXrayInspectorActive(!state.inspectorActive)
}

export function inspectPermissionXrayElement(el: HTMLElement, x: number, y: number) {
  if (!state.inspectorActive) {
    return
  }

  const { element, records } = findPermissionHost(el)
  if (hoverElement !== element) {
    clearHoverElement()
    hoverElement = element
    hoverElement.classList.add('permission-xray-hover')
  }

  state.hover = {
    elementId: records[0]?.elementId ?? element.dataset.permissionXrayId ?? '',
    hasPermission: records.length > 0,
    records,
    text: getElementText(element),
    tag: element.tagName.toLowerCase(),
    className: element.className ? String(element.className).slice(0, 120) : '',
    path: getElementPath(element),
    x,
    y,
    allowed: records.length > 0 ? records.every(item => item.allowed && !item.removed) : null,
  }
}

export function setPermissionXrayHighlight(elementId: string) {
  state.highlightId = elementId
  document.querySelectorAll('.permission-xray-highlight').forEach(item => item.classList.remove('permission-xray-highlight'))
  if (!elementId) {
    return
  }

  const target = document.querySelector(`[data-permission-xray-id="${elementId}"]`)
  if (target instanceof HTMLElement) {
    target.classList.add('permission-xray-highlight')
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }
}

export function clearPermissionXrayHighlight() {
  setPermissionXrayHighlight('')
}
