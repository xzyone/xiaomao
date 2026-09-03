<p align="center">
  <img alt="小毛毛" src="./doc/imgs/小毛毛.png" width="180" />
</p>

<h1 align="center">小毛毛</h1>
<p align="center">毛毛的快乐狗生</p>

小毛毛是一个自用的图文 / 视频记录网站，用来记录毛毛的日常。项目采用 Vue 3 + Vite 前端、Express 后端和 MySQL 数据库。

## 技术栈

- Frontend: Vue 3, Vite, Pinia
- Backend: Node.js 18, Express
- Database: MySQL 8
- Deployment: Docker Compose + 1Panel/OpenResty
- Media storage: host local storage / NAS storage

## 部署结构

生产环境建议将代码仓库与运行时媒体数据分离：

```text
<repo-dir>/
├── .git/
├── docker-compose.yml
├── deploy.sh
├── express-project/
└── vue3-project/
    └── dist/                  # 前端构建产物，可作为网站运行目录

<host-upload-dir>/
├── images/
└── videos/                    # 图片和视频等运行时数据
```

`docker-compose.yml` 只管理后端服务。后端代码在构建镜像时复制到容器 `/app`，生产环境不需要把整个 `/app` 绑定到宿主机；只有 `/app/uploads` 映射到宿主机的持久化媒体目录。

前端执行 `npm run build` 后直接生成 `vue3-project/dist`。如果使用 1Panel/OpenResty，可将网站运行目录指向该 `dist` 目录，无需再复制或同步一次构建产物。

## 首次部署

### 1. 准备环境变量

```bash
cd <repo-dir>
cp .env.example .env
```

然后修改 `.env`。至少需要确认数据库、JWT、公开访问地址和媒体目录：

```env
DB_HOST=<mysql-host>
DB_PORT=3306
DB_USER=<mysql-user>
DB_PASSWORD=<mysql-password>
DB_NAME=xiaomaodb

JWT_SECRET=<long-random-secret>
TRUST_PROXY=1

API_BASE_URL=https://example.com
LOCAL_BASE_URL=https://example.com
CORS_ORIGIN=https://example.com

IMAGE_UPLOAD_STRATEGY=local
VIDEO_UPLOAD_STRATEGY=local
IMAGE_LOCAL_UPLOAD_DIR=uploads/images
VIDEO_LOCAL_UPLOAD_DIR=uploads/videos

XIAOMAO_UPLOAD_DIR=/path/to/xiaomao/uploads
XIAOMAO_UID=1000
XIAOMAO_GID=1000
```

`.env` 已被 Git 忽略，不应提交到仓库。`XIAOMAO_UID`、`XIAOMAO_GID` 应根据宿主机实际运行用户调整。

### 2. 准备媒体目录

根据 `.env` 中的 `XIAOMAO_UPLOAD_DIR` 创建持久化目录，并确保运行用户可读写。例如：

```bash
mkdir -p /path/to/xiaomao/uploads/{images,videos}
```

具体 owner/group 和权限应按宿主机环境设置。

### 3. 部署

```bash
sh deploy.sh deploy
```

脚本会构建前端、构建并启动后端，同时保持媒体数据在代码仓库之外。脚本不会执行 `git stash`、`git clean`、`docker compose down -v` 或 volume prune。

如果构建环境需要代理，可以通过 `XIAOMAO_PROXY` 覆盖：

```bash
XIAOMAO_PROXY=http://proxy-host:port sh deploy.sh deploy
```

## 日常更新

仓库没有本地修改时可以直接：

```bash
cd <repo-dir>
sh deploy.sh update
```

`update` 会先执行 `git pull --ff-only`，然后重新构建前端和后端。如果仓库存在未提交修改，脚本会直接停止，不会自动 stash。

也可以分别执行：

```bash
sh deploy.sh frontend
sh deploy.sh backend
sh deploy.sh restart
sh deploy.sh logs
sh deploy.sh status
```

## 数据安全

图片和视频属于运行时数据，不属于 Git 仓库。应始终通过 `XIAOMAO_UPLOAD_DIR` 指向仓库之外的持久化目录。

因此代码仓库可以独立执行 `git pull`、切换分支或重新构建 Docker 镜像，不应影响已经上传的媒体文件。不要对媒体目录执行 `git stash -u`、`git clean`、`rsync --delete` 或 Docker volume 清理操作。

## 项目目录

```text
express-project/    Express API 后端
vue3-project/       Vue 3 前端
doc/                项目文档和图片
docker-compose.yml  后端生产 Compose
deploy.sh            Linux/NAS 部署脚本
.env.example         生产环境变量示例
```

## 来源与许可

本项目基于 [ZTMYO/XiaoShiLiu](https://github.com/ZTMYO/XiaoShiLiu) 二次开发，并根据个人使用需求持续调整。项目继续遵循仓库中的 [GPL-3.0 License](./LICENSE)。
