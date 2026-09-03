<p align="center">
  <img alt="小毛毛" src="./doc/imgs/小毛毛.png" width="180" />
</p>

<h1 align="center">小毛毛</h1>
<p align="center">毛毛的快乐狗生</p>
<p align="center"><a href="https://mao.kdgq.com">mao.kdgq.com</a></p>

小毛毛是一个自用的图文 / 视频记录网站，用来记录毛毛的日常。项目采用 Vue 3 + Vite 前端、Express 后端和 MySQL 数据库。

## 技术栈

- Frontend: Vue 3, Vite, Pinia
- Backend: Node.js 18, Express
- Database: MySQL 8
- Deployment: Docker Compose + 1Panel/OpenResty
- Media storage: NAS local storage

## 生产环境结构

```text
SSD
/
├── .git/
├── docker-compose.yml
├── deploy.sh
├── express-project/
└── vue3-project/
    └── dist/                      # 网站运行目录

HDD
/uploads/
├── images/
└── videos/
```


## Docker 结构

`docker-compose.yml` 只管理后端服务，后端代码在构建镜像时复制到容器 `/app`，生产环境不把整个 `/app` 绑定到宿主机。只有运行时媒体目录单独持久化：


## 首次部署

### 1. 环境变量

复制示例文件：

```bash
cd /vol1/1000/docker/1panel/1panel/www/sites/mao/index
cp .env.example .env
```

然后修改 `.env`，至少确认 MySQL、JWT 和域名配置。生产数据库使用外部 MySQL，例如：

```env
DB_HOST=<1Panel MySQL 容器名或可访问地址>
DB_PORT=3306
DB_USER=<数据库用户>
DB_PASSWORD=<数据库密码>
DB_NAME=xiaomaodb

JWT_SECRET=<随机长密钥>
TRUST_PROXY=1

IMAGE_UPLOAD_STRATEGY=local
VIDEO_UPLOAD_STRATEGY=local
IMAGE_LOCAL_UPLOAD_DIR=uploads/images
VIDEO_LOCAL_UPLOAD_DIR=uploads/videos

XIAOMAO_UPLOAD_DIR=/vol2/1000/web/data/xiaomao/uploads
```

`.env` 已被 Git 忽略，不应提交到仓库。

### 2. 准备媒体目录

```bash
mkdir -p /vol2/1000/web/data/xiaomao/uploads/{images,videos}
chown -R 1000:1001 /vol2/1000/web/data/xiaomao/uploads
find /vol2/1000/web/data/xiaomao/uploads -type d -exec chmod 2770 {} \;
find /vol2/1000/web/data/xiaomao/uploads -type f -exec chmod 660 {} \;
```

### 3. 部署

```bash
chmod +x deploy.sh
./deploy.sh deploy
```

脚本会：

1. 使用 Node 18 Docker 镜像执行 `npm ci` 和 `npm run build`，直接生成 `vue3-project/dist`；
2. 构建并启动 `xiaomao-backend`；
3. 保持媒体数据在仓库之外，不执行 `git stash`、`git clean`、`docker compose down -v` 或 volume prune。

如果 NAS 拉取镜像或安装 npm 依赖需要代理，可在运行脚本前设置：

```bash
export HTTP_PROXY=http://192.168.31.31:20172
export HTTPS_PROXY=http://192.168.31.31:20172
./deploy.sh deploy
```

## 日常更新

仓库没有本地修改时可以直接：

```bash
cd /vol1/1000/docker/1panel/1panel/www/sites/mao/index
./deploy.sh update
```

`update` 会先执行：

```bash
git pull --ff-only
```

然后重新构建前端和后端。如果仓库存在未提交修改，脚本会直接停止，不会自动 stash，避免再次把运行时数据或本地配置卷入 Git 操作。

也可以分别执行：

```bash
./deploy.sh frontend
./deploy.sh backend
./deploy.sh restart
./deploy.sh logs
./deploy.sh status
```

## 数据安全

图片和视频属于运行时数据，不属于 Git 仓库。生产环境固定放在：

```text
/vol2/1000/web/data/xiaomao/uploads
```

因此代码仓库可以安全执行 `git pull`、切换分支或重新构建 Docker 镜像，不应影响已经上传的媒体文件。

不要对媒体目录执行 `git stash -u`、`git clean`、`rsync --delete` 或 Docker volume 清理操作。

## 项目目录

```text
express-project/   Express API 后端
vue3-project/      Vue 3 前端
doc/               项目文档和图片
docker-compose.yml 后端生产 Compose
deploy.sh           Linux/NAS 部署脚本
.env.example        生产环境变量示例
```

## 来源与许可

本项目基于 [ZTMYO/XiaoShiLiu](https://github.com/ZTMYO/XiaoShiLiu) 二次开发，并根据个人使用需求持续调整。项目继续遵循仓库中的 [GPL-3.0 License](./LICENSE)。
