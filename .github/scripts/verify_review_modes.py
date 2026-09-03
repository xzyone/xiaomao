from pathlib import Path

checks = [
    ('express-project/utils/reviewPolicy.js', 'post_review_mode'),
    ('express-project/utils/reviewPolicy.js', "VERIFIED: 'verified'"),
    ('express-project/app.js', '/api/admin/system-settings'),
    ('vue3-project/src/router/index.js', 'system-settings'),
    ('vue3-project/src/views/admin/AdminLayout.vue', '系统设置'),
    ('vue3-project/src/views/admin/SystemSettings.vue', '全站免审'),
    ('vue3-project/src/views/admin/SystemSettings.vue', '认证免审'),
    ('vue3-project/src/views/admin/SystemSettings.vue', '全站审核'),
    ('vue3-project/src/views/publish/index.vue', 'status: 0 // 发布意图'),
]

failed = False
for file_name, needle in checks:
    text = Path(file_name).read_text()
    if needle not in text:
        print(f'MISSING: {file_name}: {needle}')
        failed = True
    else:
        print(f'OK: {file_name}: {needle}')

publish_text = Path('vue3-project/src/views/publish/index.vue').read_text()
legacy = 'status: 2 // 发布状态：2=待审核'
if legacy in publish_text:
    print(f'LEGACY STILL PRESENT: {legacy}')
    failed = True
else:
    print('OK: legacy hard-coded review status removed')

if failed:
    raise SystemExit(1)
