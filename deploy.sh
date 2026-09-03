#!/bin/sh
set -eu

REPO_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
FRONTEND_DIR="$REPO_DIR/vue3-project"
UPLOAD_DIR="${XIAOMAO_UPLOAD_DIR:-/vol2/1000/web/data/xiaomao/uploads}"

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

build_frontend() {
  echo "Building frontend..."
  docker run --rm \
    -e HTTP_PROXY="${HTTP_PROXY:-}" \
    -e HTTPS_PROXY="${HTTPS_PROXY:-}" \
    -e http_proxy="${http_proxy:-${HTTP_PROXY:-}}" \
    -e https_proxy="${https_proxy:-${HTTPS_PROXY:-}}" \
    -v "$FRONTEND_DIR:/app" \
    -w /app \
    node:18-alpine \
    sh -c 'npm ci --no-audit --no-fund && npm run build'

  chown -R 1000:1001 "$FRONTEND_DIR/dist" 2>/dev/null || true
  echo "Frontend ready: $FRONTEND_DIR/dist"
}

build_backend() {
  echo "Building backend..."
  docker compose build backend
  docker compose up -d backend
  echo "Backend ready: http://127.0.0.1:1220"
}

update_repo() {
  if [ -n "$(git status --porcelain)" ]; then
    echo "Repository has local changes. Update aborted to avoid overwriting local files." >&2
    git status --short
    exit 1
  fi

  git pull --ff-only
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
