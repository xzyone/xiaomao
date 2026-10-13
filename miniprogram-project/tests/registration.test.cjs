const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '../..')
function pageHarness(api = {}) {
  let page
  const storage = {}
  const app = { ensureWritableMode: async () => true, getUiText: (g, k) => k, globalData: {} }
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram-project/pages/login/index.js'), 'utf8'), {
    require: name => name.includes('services/api') ? api : name.includes('config') ? { apiBaseUrl: '' } : { getServerOrigin: () => '' },
    Page: value => { page = value }, getApp: () => app,
    wx: { setStorageSync: (k, v) => { storage[k] = v }, showToast() {} },
    setTimeout() {}, clearInterval() {}, Date
  })
  page.setData = update => Object.assign(page.data, update)
  Object.assign(page.data, { registerMode: true, userId: 'test_user', nickname: '测试', password: 'secret12', confirmPassword: 'secret12', email: 'test@example.com', emailCode: '123456', captchaId: 'captcha-id', captchaText: 'AbCd' })
  return { page, app, storage }
}
test('registration sends both challenges and saves authenticated session', async () => {
  let payload
  const { page, storage, app } = pageHarness({ register: async data => {
    payload = data
    return { tokens: { access_token: 'access', refresh_token: 'refresh' }, user: { id: 1 } }
  } })
  await page.submit()
  assert.equal(payload.emailCode, '123456')
  assert.equal(payload.captchaId, 'captcha-id')
  assert.equal(payload.captchaText, 'AbCd')
  assert.equal(storage.token, 'access')
  assert.equal(app.globalData.sessionValid, true)
})
test('missing email code and mismatched password stop registration', async () => {
  let called = false
  const { page } = pageHarness({ register: async () => { called = true } })
  page.data.emailCode = ''
  await page.submit()
  assert.equal(called, false)
  page.data.emailCode = '123456'
  page.data.confirmPassword = 'different'
  assert.equal(page.validateRegistration(), 'registerPasswordMismatch')
})
test('readonly mode prevents submission', async () => {
  let called = false
  const { page, app } = pageHarness({ register: async () => { called = true } })
  app.ensureWritableMode = async () => false
  await page.submit()
  assert.equal(called, false)
})
test('failed registration refreshes consumed captcha', async () => {
  const { page } = pageHarness({ register: async () => { throw new Error('邮箱验证码错误') } })
  let refreshed = false
  page.refreshCaptcha = async () => { refreshed = true }
  await page.submit()
  assert.equal(refreshed, true)
  assert.equal(page.data.submitting, false)
})
test('all registration copy has backend, client and admin mappings', () => {
  const files = ['express-project/utils/miniappPolicy.js', 'miniprogram-project/app.js', 'vue3-project/src/views/admin/SystemSettings.vue'].map(file => fs.readFileSync(path.join(root, file), 'utf8'))
  const keys = [...new Set(files[1].match(/register[A-Z]\w+/g))]
  for (const key of keys) {
    for (const source of files) assert.ok(source.includes(`${key}:`), key)
    assert.ok(files[2].includes(`key: '${key}'`), key)
  }
})
