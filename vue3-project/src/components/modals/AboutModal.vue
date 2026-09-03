<template>
  <div class="about-modal-overlay" v-click-outside.mousedown="closeModal" v-escape-key="closeModal"
    :class="{ animating: isAnimating }">
    <div class="about-modal" @click.stop :class="{ 'scale-in': isAnimating }">
      <div class="about-header">
        <div class="header-content">
          <div class="logo-section">
            <div class="about-logo">
              <img :src="logoUrl" alt="小毛毛" />
            </div>
            <h2 class="about-title">关于小毛毛</h2>
          </div>
        </div>
        <button class="close-btn" @click="closeModal">
          <SvgIcon name="close" />
        </button>
      </div>

      <div class="about-content">
        <div class="about-main">
          <section class="content-section">
            <h3>小毛毛是谁</h3>
            <p>毛毛是一只陨石边牧，出生于 2024 年 12 月 22 日，2025 年 3 月 14 日正式加入我们的家庭。</p>
            <p>“小毛毛”这个网站因他而存在。这里主要用来记录毛毛成长中的照片、视频和日常，也希望把那些平时很容易被忘掉的小事情，一点一点保存下来。</p>
          </section>

          <section class="content-section">
            <h3>关于这个网站</h3>
            <p>小毛毛是一个自建的生活记录社区。</p>
            <p>除了记录毛毛，也可以用来分享照片、视频和生活片段，并通过分类、标签、评论、点赞、收藏和关注等功能，把不同时间留下的内容慢慢整理起来。</p>
            <p>相比追求复杂的推荐算法，这里更希望内容按照它发生的时间自然留下来——今天的、昨天的，以及很久以前的，都应该能重新被看到。</p>
          </section>

          <section class="content-section">
            <h3>技术实现</h3>
            <p>网站前端基于 Vue 3、Vite 和 Pinia，后端使用 Node.js、Express 和 MySQL。</p>
            <p>服务部署在自有设备上，用户上传的图片和视频使用本地存储。项目仍在持续迭代中，很多功能也会随着实际使用逐步调整。</p>
          </section>

          <section class="content-section">
            <h3>隐私说明</h3>
            <p>我们尽量遵循数据最小化原则，只保存网站正常运行所需要的数据。</p>
            <p>密码仅以安全哈希形式保存，不存储明文密码。</p>
            <p>IP 属地仅用于展示发布文章或评论时的大致地区，系统保存的是解析后的属地信息，而不是将完整 IP 地址作为内容信息长期保存。</p>
          </section>

          <section class="content-section">
            <h3>开源与致谢</h3>
            <p>小毛毛基于开源项目进行二次开发，并在此基础上持续调整界面、功能和部署方式。</p>
            <p>项目代码按照 GPLv3 开源协议发布。感谢原项目作者以及项目所使用的各类开源软件和社区。</p>
          </section>

          <div class="about-footer">
            <p>© {{ currentYear }} 小毛毛 · 记录毛毛的快乐狗生</p>
            <div class="filing-links">
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">豫ICP备16000356号</a>
              <span>·</span>
              <a href="https://beian.mps.gov.cn/#/query/webSearch" target="_blank" rel="noopener noreferrer">粤公网安备44030002009199号</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { useScrollLock } from '@/composables/useScrollLock'

const emit = defineEmits(['close'])
const { lock, unlock } = useScrollLock()

const logoUrl = new URL('@/assets/imgs/小毛毛.png', import.meta.url).href
const currentYear = new Date().getFullYear()
const isAnimating = ref(false)

const closeModal = () => {
  isAnimating.value = false
  unlock()
  setTimeout(() => {
    emit('close')
  }, 200)
}

onMounted(() => {
  lock()
  setTimeout(() => {
    isAnimating.value = true
  }, 10)
})
</script>

<style scoped>
.about-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.about-modal-overlay.animating {
  opacity: 1;
}

.about-modal {
  background: var(--bg-color-primary);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  position: relative;
  transform: scale(0.9);
  transition: transform 0.2s ease;
  box-shadow: 0 20px 40px var(--shadow-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.about-modal.scale-in {
  transform: scale(1);
}

.about-header {
  position: relative;
  background: var(--bg-color-primary);
  padding: 24px 32px;
  border-radius: 16px 16px 0 0;
  flex-shrink: 0;
}

.header-content {
  text-align: center;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
  transition: all 0.2s ease;
}

.close-btn:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

.about-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}

.logo-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.about-logo {
  width: 104px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.about-logo img {
  width: 104px;
  height: auto;
  max-height: 40px;
  object-fit: contain;
}

.about-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin: 0;
}

.about-main {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.content-section h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin: 0 0 12px 0;
}

.content-section p {
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-color-secondary);
  margin: 0 0 12px 0;
}

.content-section p:last-child {
  margin-bottom: 0;
}

.about-footer {
  text-align: center;
  margin-top: 4px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color-primary);
}

.about-footer p {
  font-size: 13px;
  color: var(--text-color-tertiary);
  margin: 0;
}

.filing-links {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-color-tertiary);
}

.filing-links a {
  color: var(--text-color-tertiary);
  text-decoration: none;
  transition: color 0.2s ease;
}

.filing-links a:hover {
  color: var(--text-color-primary);
}

@media (max-width: 768px) {
  .about-modal {
    width: 100vw;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
    transform: scale(1);
  }

  .about-modal.scale-in {
    transform: scale(1);
  }

  .close-btn {
    position: fixed;
    top: 40px;
    left: 16px;
    z-index: 2001;
    background: transparent;
    color: var(--text-color-secondary);
    width: 36px;
    height: 36px;
  }

  .close-btn:hover {
    background: rgba(144, 144, 144, 0.292);
    transform: scale(1);
  }

  .about-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2000;
    height: calc(72px + constant(safe-area-inset-top));
    height: calc(72px + env(safe-area-inset-top));
    padding: 12px 16px;
    padding-left: 60px;
    background: var(--bg-color-primary);
    border-bottom: 1px solid var(--border-color-primary);
    border-radius: 0;
  }

  .about-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding-top: calc(100px + constant(safe-area-inset-top));
    padding-top: calc(100px + env(safe-area-inset-top));
    padding-bottom: calc(32px + constant(safe-area-inset-bottom));
    padding-bottom: calc(32px + env(safe-area-inset-bottom));
    padding-left: 16px;
    padding-right: 16px;
    max-width: 100vw;
    box-sizing: border-box;
    -webkit-overflow-scrolling: touch;
    touch-action: auto;
    overscroll-behavior: contain;
  }

  .logo-section {
    flex-direction: row;
    padding-top: 12px;
    gap: 12px;
  }

  .about-title {
    font-size: 24px;
  }

  .filing-links {
    gap: 6px;
  }
}
</style>
