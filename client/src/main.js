import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueRouter from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.vue'

// Create Vue app
const app = createApp(App)

// Use plugins
app.use(createPinia())
app.use(VueRouter)
app.use(ElementPlus)

// Mount app
app.mount('#app')