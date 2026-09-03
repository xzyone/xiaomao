from pathlib import Path

path = Path('.github/scripts/apply_review_modes.py')
text = path.read_text()

blocks = [
'''replace_count(
    'vue3-project/src/views/publish/index.vue',
    "status: 2 // 发布状态：2=待审核",
    "status: 0 // 发布意图：最终是否审核由后端系统设置决定",
    2
)''',
'''replace_count(
    'vue3-project/src/views/publish/index.vue',
    "showMessage('发布成功！', 'success')",
    "showMessage(response.message || '发布成功！', 'success')",
    2
)'''
]

for old in blocks:
    if old not in text:
        raise SystemExit(f'Expected patch block not found: {old}')
    text = text.replace(old, old[:-3] + '1\n)', 1)

path.write_text(text)
