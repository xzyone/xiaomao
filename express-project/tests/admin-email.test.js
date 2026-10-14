const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8')
function setup(rows = []) {
  const calls = []
  const context = { pool: { execute: async (sql, params) => { calls.push({ sql, params }); return [rows] } }, RESPONSE_CODES: { CONFLICT: 409 } }
  vm.createContext(context)
  vm.runInContext(source.slice(source.indexOf('async function validateAdminUserEmail'), source.indexOf('const usersHandlers =')) + '\nthis.config = usersCrudConfig', context)
  return { context, calls, config: context.config }
}
test('CRUD update forwards email and trims it before persistence', async () => {
  const { config, calls } = setup()
  assert.ok(config.updateFields.includes('email'))
  const data = { email: ' test@example.com ' }
  const result = await config.beforeUpdate(data, '42')
  assert.equal(result.isValid, true)
  assert.equal(data.email, 'test@example.com')
  assert.match(calls[0].sql, /AND id != \?/)
  assert.equal(calls[0].params[1], '42')
})
test('empty email clears binding, omitted email stays omitted', async () => {
  const { config, calls } = setup()
  const empty = { email: '  ' }
  assert.equal((await config.beforeUpdate(empty, '42')).isValid, true)
  assert.equal(empty.email, '')
  const omitted = { nickname: 'test' }
  await config.beforeUpdate(omitted, '42')
  assert.equal(Object.hasOwn(omitted, 'email'), false)
  assert.equal(calls.length, 0)
})
test('invalid and duplicate emails cannot be saved', async () => {
  const { config } = setup([{ id: 7 }])
  for (const email of ['invalid', 'a@ b.com', {}, null]) {
    assert.equal((await config.beforeUpdate({ email }, '42')).isValid, false)
  }
  const result = await config.beforeUpdate({ email: 'used@example.com' }, '42')
  assert.equal(result.isValid, false)
  assert.equal(result.code, 409)
})
test('admin creation also rejects duplicate emails before hashing password', async () => {
  const { config, calls } = setup([{ id: 7 }])
  assert.equal((await config.beforeCreate({ email: 'used@example.com' })).isValid, false)
  assert.equal(calls.length, 1)
})
test('list and detail queries retain the stored email', async () => {
  const { config, calls } = setup([{ id: 42, email: 'stored@example.com', ban_status: -1, total: 1 }])
  const item = await config.customQueries.getOne({ params: { id: 42 } })
  const list = await config.customQueries.getList({ query: {} })
  assert.equal(item.email, 'stored@example.com')
  assert.equal(list.data[0].email, 'stored@example.com')
  assert.match(calls[0].sql, /SELECT u\.\*/)
})
