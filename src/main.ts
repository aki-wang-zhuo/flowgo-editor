/**
 * FlowGo Editor 入口。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import { setupI18n } from './i18n'
import './styles/base.css'
import './assets/iconfont/iconfont.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
setupI18n(app)
// Element Plus 语言由 App.vue 的 el-config-provider 按当前 locale 注入
app.use(ElementPlus)
app.mount('#app')
