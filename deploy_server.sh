#!/usr/bin/env bash
set -euo pipefail

# ==== EDIT THESE ====
# Bastion path (default). Replace these 3 values.
BASTION_IP="<BASTION_PUBLIC_IP>"
PRIVATE_VM_IP="<PRIVATE_VM_IP>"
SSH_KEY="${SSH_KEY:-~/.ssh/<YOUR_KEY>}"
SSH_OPTS="-i ${SSH_KEY} -J ubuntu@${BASTION_IP}"
TARGET_HOST="ubuntu@${PRIVATE_VM_IP}"

# # Tailscale path (alternative). Comment the 4 lines above and use the 4 lines below:
# VM_TS_IP="<VM_TAILSCALE_IP>"
# SSH_KEY="${SSH_KEY:-~/.ssh/<YOUR_KEY>}"
# SSH_OPTS="-i ${SSH_KEY}"
# TARGET_HOST="ubuntu@${VM_TS_IP}"

APP_DIR="/opt/oyo.plus"

echo "== Syncing source to VM =="
rsync -avz --delete \
  --exclude ".git" --exclude "node_modules" --exclude ".env" \
  -e "ssh ${SSH_OPTS}" \
  "./" "${TARGET_HOST}:${APP_DIR}/"

echo "== Installing production deps on VM =="
ssh ${SSH_OPTS} "${TARGET_HOST}" "cd ${APP_DIR} && npm ci --omit=dev"

echo "== Restarting service =="
ssh ${SSH_OPTS} "${TARGET_HOST}" "sudo systemctl restart oyo.service && sudo systemctl status oyo.service --no-pager -l || true"

echo "== Hitting the public URL via Cloudflare =="
curl -I https://oyo.plus || true

echo '✅ Deploy complete.'
