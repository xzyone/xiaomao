import { createRouter, createWebHistory } from 'vue-router'
import { getValidChannelPaths } from '@/config/channels'

// Route components are lazy-loaded so the initial bundle only contains the
// application bootstrap and code required to resolve the current route.
const layout = () => import('@/views/layout/index.vue')
const explore = () => import('@/views/explore/index.vue')
const ChannelPage = () => import('@/views/explore/ChannelPage.vue')
const publish = () => import('@/views/publish/index.vue')
const notification = () => import('@/views/notification/index.vue')
const user = () => import('@/views/user/index.vue')
const userProfile = () => import('@/views/user/UserProfile.vue')
const FollowList = () => import('@/views/user/FollowList.vue')
const PostDetail = () => import('@/views/PostDetail.vue')
const SearchResult = () => import('@/views/search/SearchResult.vue')
const PostManagementPage = () => import('@/views/post-management/index.vue')
const DraftBoxPage = () => import('@/views/draft-box/index.vue')
const RecycleBinPage = () => import('@/views/recycle-bin/index.vue')
const NotFound = () => import('@/views/NotFound.vue')

// Admin routes are intentionally lazy so the public site does not ship the
// management UI in its initial JavaScript bundle.
const AdminLogin = () => import('@/views/admin/AdminLogin.vue')
const AdminLayout = () => import('@/views/admin/AdminLayout.vue')
const ApiDocs = () => import('@/views/admin/ApiDocs.vue')
const AdminMonitor = () => import('@/views/admin/AdminMonitor.vue')
const UserManagement = () => import('@/views/admin/UserManagement.vue')
const PostManagement = () => import('@/views/admin/PostManagement.vue')
const CommentManagement = () => import('@/views/admin/CommentManagement.vue')
const CategoryManagement = () => import('@/views/admin/CategoryManagement.vue')
const TagManagement = () => import('@/views/admin/TagManagement.vue')
const LikeManagement = () => import('@/views/admin/LikeManagement.vue')
const CollectionManagement = () => import('@/views/admin/CollectionManagement.vue')
const FollowManagement = () => import('@/views/admin/FollowManagement.vue')
const NotificationManagement = () => import('@/views/admin/NotificationManagement.vue')
const SessionManagement = () => import('@/views/admin/SessionManagement.vue')
const AdminSessionManagement = () => import('@/views/admin/AdminSessionManagement.vue')
const AdminManagement = () => import('@/views/admin/AdminManagement.vue')
const AuditManagement = () => import('@/views/admin/AuditManagement.vue')
const PostAudit = () => import('@/views/admin/PostAudit.vue')
const SystemSettings = () => import('@/views/admin/SystemSettings.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: layout,
      redirect: '/explore',
      children: [
        {
          path: '/explore',
          name: 'explore',
          component: explore,
          children: [
            {
              path: '',
              name: 'recommend',
              component: ChannelPage
            },
            {
              path: '/explore/:channel',
              name: 'channel',
              component: ChannelPage,
              beforeEnter: (to, from, next) => {
                // 验证频道是否有效
                const validChannelPaths = getValidChannelPaths()
                if (validChannelPaths.includes(to.params.channel)) {
                  to.name = to.params.channel
                  next()
                } else {
                  // 无效频道重定向到推荐页
                  next('/explore')
                }
              }
            }
          ]
        },
        {
          path: '/post',
          name: 'post_detail',
          component: PostDetail
        },
        {
          path: 'publish',
          name: 'publish',
          component: publish,
        },
        {
          path: 'notification',
          name: 'notification',
          component: notification,
        },
        {
          path: 'user',
          name: 'user',
          component: user,
        },
        {
          path: 'user/:userId',
          name: 'user_profile',
          component: userProfile,
        },
        {
          path: 'follow/:type',
          name: 'follow_list',
          component: FollowList,
          beforeEnter: (to, from, next) => {
            // 验证type参数是否有效
            const validTypes = ['mutual', 'following', 'followers']
            if (validTypes.includes(to.params.type)) {
              next()
            } else {
              // 无效type重定向到following
              next({
                name: 'follow_list',
                params: { type: 'following' }
              })
            }
          }
        },
        {
          path: 'search_result',
          name: 'search_result',
          component: SearchResult,
          beforeEnter: (to, from, next) => {
            // 自动重定向到 "全部" tab
            next({
              name: 'search_result_tab',
              params: { tab: 'all' },
              query: to.query // 保持查询参数（如keyword）
            })
          }
        },
        {
          path: 'search_result/:tab',
          name: 'search_result_tab',
          component: SearchResult,
          beforeEnter: (to, from, next) => {
            // 验证tab参数是否有效
            const validTabs = ['all', 'post', 'video', 'user']
            if (validTabs.includes(to.params.tab)) {
              next()
            } else {
              // 无效tab重定向到all
              next({
                name: 'search_result_tab',
                params: { tab: 'all' },
                query: to.query
              })
            }
          }
        },
        {
          path: 'post-management',
          name: 'post_management',
          component: PostManagementPage
        },
        {
          path: 'draft-box',
          name: 'draft_box',
          component: DraftBoxPage
        },
        {
          path: 'recycle-bin',
          name: 'recycle_bin',
          component: RecycleBinPage
        },
        // 404页面 - 捕获所有未匹配的路由
        {
          path: '/:pathMatch(.*)*',
          name: 'not_found',
          component: NotFound
        }
      ]
    },
    // Admin登录页面
    {
      path: '/admin/login',
      name: 'admin_login',
      component: AdminLogin
    },
    // 后台管理系统路由
    {
      path: '/admin',
      component: AdminLayout,
      beforeEnter: (to, from, next) => {
        // 如果访问的是/admin根路径，重定向到api-docs
        if (to.path === '/admin') {
          next('/admin/api-docs')
        } else {
          next()
        }
      },
      children: [
        {
          path: 'api-docs',
          name: 'admin_api_docs',
          component: ApiDocs
        },
        {
          path: 'monitor',
          name: 'admin_monitor',
          component: AdminMonitor
        },
        {
          path: 'system-settings',
          name: 'admin_system_settings',
          component: SystemSettings
        },
        {
          path: 'users',
          name: 'admin_users',
          component: UserManagement
        },
        {
          path: 'post-audit',
          name: 'admin_post_audit',
          component: PostAudit
        },
        {
          path: 'posts',
          name: 'admin_posts',
          component: PostManagement
        },
        {
          path: 'comments',
          name: 'admin_comments',
          component: CommentManagement
        },
        {
          path: 'categories',
          name: 'admin_categories',
          component: CategoryManagement
        },
        {
          path: 'tags',
          name: 'admin_tags',
          component: TagManagement
        },
        {
          path: 'likes',
          name: 'admin_likes',
          component: LikeManagement
        },
        {
          path: 'collections',
          name: 'admin_collections',
          component: CollectionManagement
        },
        {
          path: 'follows',
          name: 'admin_follows',
          component: FollowManagement
        },
        {
          path: 'notifications',
          name: 'admin_notifications',
          component: NotificationManagement
        },
        {
          path: 'sessions',
          name: 'admin_sessions',
          component: SessionManagement
        },
        {
          path: 'admin-sessions',
          name: 'admin_admin_sessions',
          component: AdminSessionManagement
        },
        {
          path: 'admins',
          name: 'admin_admins',
          component: AdminManagement
        },
        {
          path: 'audit',
          name: 'admin_audit',
          component: AuditManagement
        }
      ]
    }
  ],
})

export default router
