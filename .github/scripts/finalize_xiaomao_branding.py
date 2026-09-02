from pathlib import Path

from PIL import Image

ROOT = Path('.')
WORKFLOW_PATH = Path('.github/workflows/xiaomao-branding-final.yml')
SCRIPT_PATH = Path('.github/scripts/finalize_xiaomao_branding.py')
EXCLUDED_DIRS = {'.git', 'node_modules', 'dist', '.vite'}

REPLACEMENTS = [
    ('小石榴 - 你的校园图文部落', '小毛毛 - 毛毛的快乐狗生'),
    ('小石榴校园图文社区', '小毛毛生活社区'),
    ('小石榴图文社区', '小毛毛社区'),
    ('小毛毛校园图文社区', '小毛毛生活社区'),
    ('小毛毛图文社区', '小毛毛社区'),
    ('小石榴号', '毛毛号'),
    ('石榴号', '毛毛号'),
    ('小石榴', '小毛毛'),
    ('石榴', '毛毛'),
    ('ZTMYO/XiaoShiLiu', 'xzyone/xiaomao'),
    ('XiaoShiLiu', 'XiaoMao'),
    ('Xiaoshiliu', 'Xiaomao'),
    ('XIAOSHILIU', 'XIAOMAO'),
    ('xiaoshiliu', 'xiaomao'),
    ('https://www.shiliu.space', 'https://mao.kdgq.com'),
    ('https://shiliu.space', 'https://mao.kdgq.com'),
    ('VITE_APP_TITLE=小毛毛社区', 'VITE_APP_TITLE=小毛毛 - 毛毛的快乐狗生'),
    ('VITE_APP_TITLE=小毛毛生活社区', 'VITE_APP_TITLE=小毛毛 - 毛毛的快乐狗生'),
    ('VITE_APP_TITLE=小毛毛图文社区', 'VITE_APP_TITLE=小毛毛 - 毛毛的快乐狗生'),
    ('小毛毛.svg', '小毛毛.png'),
]

changed_paths: set[str] = set()


def replace_all_text_branding() -> None:
    for path in ROOT.rglob('*'):
        if not path.is_file() or path in {WORKFLOW_PATH, SCRIPT_PATH}:
            continue
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue

        try:
            original = path.read_text(encoding='utf-8')
        except (UnicodeDecodeError, OSError):
            continue

        updated = original
        for old, new in REPLACEMENTS:
            updated = updated.replace(old, new)

        if updated != original:
            path.write_text(updated, encoding='utf-8')
            changed_paths.add(str(path))


def replace_required(path_str: str, old: str, new: str) -> None:
    path = Path(path_str)
    text = path.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'Expected block not found in {path_str}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    changed_paths.add(path_str)


def update_logo_layouts() -> None:
    replace_required(
        'vue3-project/src/views/layout/components/LayoutHeader.vue',
        '''.logo {
    width: 68.32px;
    height: 32px;
    color: var(--button-text-color);
    background: var(--primary-color);
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
}

img {
    width: 68.32px;
    height: 32px;
}''',
        '''.logo {
    width: 96px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.logo img {
    display: block;
    width: 96px;
    height: auto;
    max-height: 40px;
    object-fit: contain;
}''',
    )

    replace_required(
        'vue3-project/src/components/modals/AboutModal.vue',
        '''.about-logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
}

.about-logo img {
  width: 120%;
  height: 100%;
  object-fit: contain;
}''',
        '''.about-logo {
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
}''',
    )

    admin_path = Path('vue3-project/src/views/admin/AdminLayout.vue')
    admin_text = admin_path.read_text(encoding='utf-8')
    wordmark_ref = "new URL('@/assets/imgs/小毛毛.png', import.meta.url).href"
    icon_ref = "new URL('@/assets/imgs/小毛毛图标.png', import.meta.url).href"
    if wordmark_ref not in admin_text:
        raise RuntimeError('Expected XiaoMao wordmark reference not found in AdminLayout.vue')
    admin_path.write_text(admin_text.replace(wordmark_ref, icon_ref, 1), encoding='utf-8')
    changed_paths.add(str(admin_path))

    replace_required(
        'vue3-project/src/views/admin/AdminLayout.vue',
        '''.logo-icon {
  width: 40px;
  height: 40px;
  background: var(--primary-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon img {
  width: 120%;
  height: 100%;
  object-fit: contain;
}''',
        '''.logo-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon img {
  width: 40px;
  height: 40px;
  object-fit: contain;
}''',
    )


def remove_superseded_svg_logos() -> None:
    for path in [
        Path('vue3-project/src/assets/imgs/小毛毛.svg'),
        Path('doc/imgs/小毛毛.svg'),
    ]:
        if path.exists():
            path.unlink()
            changed_paths.add(str(path))


def generate_browser_icons() -> None:
    source_path = Path('vue3-project/src/assets/imgs/小毛毛图标.png')
    icon_source = Image.open(source_path).convert('RGBA')

    def save_square(path_str: str, size: int) -> None:
        output = icon_source.resize((size, size), Image.Resampling.LANCZOS)
        output.save(path_str, optimize=True)
        changed_paths.add(path_str)

    save_square('vue3-project/public/favicon-32x32.png', 32)
    save_square('vue3-project/public/favicon-64x64.png', 64)
    save_square('vue3-project/public/apple-touch-icon.png', 180)
    save_square('vue3-project/public/android-icon-192x192.png', 192)
    save_square('vue3-project/public/android-icon-512x512.png', 512)

    ico_path = 'vue3-project/public/logo.ico'
    icon_source.save(
        ico_path,
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    changed_paths.add(ico_path)


replace_all_text_branding()
update_logo_layouts()
remove_superseded_svg_logos()
generate_browser_icons()

print(f'Updated {len(changed_paths)} paths:')
for changed_path in sorted(changed_paths):
    print(f'  - {changed_path}')
