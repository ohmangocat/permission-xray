import type { MineToolbarExpose, Plugin } from '#/global'
import { registerPermissionXrayDirectives } from './utils/permission-xray'

const pluginConfig: Plugin.PluginConfig = {
  install(app) {
    registerPermissionXrayDirectives(app)

    const toolbars = app.config.globalProperties.$toolbars as MineToolbarExpose
    toolbars.add({
      name: 'permissionXray',
      title: '权限透视',
      icon: 'material-symbols:policy-rounded',
      show: true,
      component: () => import('./components/permission-xray.vue'),
    })
    console.log('permission-xray plugin loaded')
  },
  config: {
    enable: true,
    info: {
      name: 'xjlldw/permission-xray',
      version: '1.0.0',
      author: 'xjlldw',
      description: '权限透视器顶部工具栏插件',
    },
  },
  views: [],
}

export default pluginConfig
