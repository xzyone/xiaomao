#!/bin/sh
set -eu

REPO_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
FRONTEND_DIR="$REPO_DIR/vue3-project"
UPLOAD_DIR="${XIAOMAO_UPLOAD_DIR:-/vol2/1000/web/data/xiaomao/uploads}"
DEFAULT_PROXY="http://192.168.31.31:20172"
PROXY_URL="${XIAOMAO_PROXY-$DEFAULT_PROXY}"

cd "$REPO_DIR"

usage() {
  cat <<'EOF'
XiaoMao Linux/NAS deployment helper

Usage:
  ./deploy.sh deploy    Build frontend and rebuild/start backend (default)
  ./deploy.sh update    git pull --ff-only, then deploy
  ./deploy.sh frontend  Build Vue frontend only
  ./deploy.sh backend   Rebuild/start backend only
  ./deploy.sh restart   Restart backend container
  ./deploy.sh stop      Stop backend container
  ./deploy.sh logs      Follow backend logs
  ./deploy.sh status    Show compose status

Default build proxy:
  http://192.168.31.31:20172

Override it with XIAOMAO_PROXY, or disable it for one run with:
  XIAOMAO_PROXY= ./deploy.sh deploy

This script never runs git stash, git clean, docker compose down -v, or volume prune.
EOF
}

check_docker() {
  command -v docker >/dev/null 2>&1 || {
    echo "Docker is not installed." >&2
    exit 1
  }

  docker compose version >/dev/null 2>&1 || {
    echo "Docker Compose plugin is not available." >&2
    exit 1
  }
}

check_env() {
  if [ ! -f "$REPO_DIR/.env" ]; then
    echo "Missing $REPO_DIR/.env" >&2
    echo "Copy .env.example to .env and fill in the production values first." >&2
    exit 1
  fi
}

prepare_uploads() {
  mkdir -p "$UPLOAD_DIR/images" "$UPLOAD_DIR/videos"
  chown 1000:1001 "$UPLOAD_DIR" "$UPLOAD_DIR/images" "$UPLOAD_DIR/videos" 2>/dev/null || true
  chmod 2770 "$UPLOAD_DIR" "$UPLOAD_DIR/images" "$UPLOAD_DIR/videos" 2>/dev/null || true
}

show_proxy() {
  if [ -n "$PROXY_URL" ]; then
    echo "Build proxy: $PROXY_URL"
  else
    echo "Build proxy: disabled"
  fi
}

build_frontend() {
  echo "Building frontend..."
  show_proxy

  docker run --rm \
    -e HTTP_PROXY="$PROXY_URL" \
    -e HTTPS_PROXY="$PROXY_URL" \
    -e http_proxy="$PROXY_URL" \
    -e https_proxy="$PROXY_URL" \
    -v "$FRONTEND_DIR:/app" \
    -w /app \
    node:18-alpine \
    sh -c 'npm ci --no-audit --no-fund && npm run build'

  chown -R 1000:1001 "$FRONTEND_DIR/dist" 2>/dev/null || true
  echo "Frontend ready: $FRONTEND_DIR/dist"
}

build_backend() {
  echo "Building backend..."
  show_proxy

  docker compose build \
    --build-arg HTTP_PROXY="$PROXY_URL" \
    --build-arg HTTPS_PROXY="$PROXY_URL" \
    --build-arg http_proxy="$PROXY_URL" \
    --build-arg https_proxy="$PROXY_URL" \
    backend

  docker compose up -d backend
  echo "Backend ready: http://127.0.0.1:1220"
}

update_repo() {
  if [ -n "$(git status --porcelain)" ]; then
    echo "Repository has local changes. Update aborted to avoid overwriting local files." >&2
    git status --short
    exit 1
  fi

  if [ -n "$PROXY_URL" ]; then
    HTTP_PROXY="$PROXY_URL" HTTPS_PROXY="$PROXY_URL" \
      http_proxy="$PROXY_URL" https_proxy="$PROXY_URL" \
      git pull --ff-only
  else
    git pull --ff-only
  fi
}

deploy_all() {
  check_env
  prepare_uploads
  build_frontend
  build_backend
}

check_docker

case "${1:-deploy}" in
  deploy)
    deploy_all
    ;;
  update)
    update_repo
    deploy_all
    ;;
  frontend)
    build_frontend
    ;;
  backend)
    check_env
    prepare_uploads
    build_backend
    ;;
  restart)
    docker compose restart backend
    ;;
  stop)
    docker compose stop backend
    ;;
  logs)
    docker compose logs -f backend
    ;;
  status)
    docker compose ps
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
