import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../store/auth'

// Import components
const Login = () => import('../components/Login.vue')
const Register = () => import('../components/Register.vue')
const ImageList = () => import('../components/ImageList.vue')
const AnnotationView = () => import('../components/AnnotationView.vue')

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      name: 'Login',
      component: Login,
      meta: { requiresAuth: false }
    },
    {
      path: '/register',
      name: 'Register',
      component: Register,
      meta: { requiresAuth: true } // 只有登录用户才能注册新用户
    },
    {
      path: '/images',
      name: 'ImageList',
      component: ImageList,
      meta: { requiresAuth: true }
    },
    {
      path: '/annotations/:id',
      name: 'AnnotationView',
      component: AnnotationView,
      meta: { requiresAuth: true }
    }
  ]
})

// Route guard
router.beforeEach((to, from, next) => {
  // Access auth store to check login status
  const authStore = useAuthStore()

  if (to.matched.some(record => record.meta.requiresAuth)) {
    // Check if user is logged in
    if (!authStore.isLoggedIn) {
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
    } else {
      next()
    }
  } else {
    // No authentication required
    next()
  }
})

export default router