#!/bin/bash
# ============================================================
# Y-OS — init-env.sh
# Charge les secrets depuis 1Password et les exporte en env
# Usage : source ./init-env.sh
# Requis : op CLI installé + OP_SERVICE_ACCOUNT_TOKEN en env
# ============================================================

set -e

echo "🔐 Y-OS — Loading secrets from 1Password..."

# Installer op CLI si absent
if ! command -v op &> /dev/null; then
  echo "  Installing 1Password CLI..."
  curl -sS https://cache.agilebits.com/dist/1P/op2/pkg/v2.30.3/op_linux_amd64_v2.30.3.zip -o /tmp/op.zip
  unzip -q /tmp/op.zip -d /tmp/op_install
  sudo mv /tmp/op_install/op /usr/local/bin/op
fi

# Charger le PAT GitHub full access depuis 1Password
GITHUB_PAT_WRITE=$(OP_SERVICE_ACCOUNT_TOKEN=$OP_SERVICE_ACCOUNT_TOKEN \
  op item get "GitHub PAT — Manus Full Access (yj000018)" \
  --vault "MAIN VAULT" \
  --fields credential \
  --reveal 2>/dev/null)

if [ -n "$GITHUB_PAT_WRITE" ]; then
  export GITHUB_PAT_WRITE
  # Configurer git pour utiliser ce PAT
  git config --global credential.helper store
  echo "https://yj000018:${GITHUB_PAT_WRITE}@github.com" > ~/.git-credentials
  echo "  ✅ GITHUB_PAT_WRITE loaded"
else
  echo "  ⚠️  GITHUB_PAT_WRITE not found in 1Password"
fi

echo ""
echo "✅ Y-OS env ready."
echo "   GITHUB_PAT_WRITE : ${GITHUB_PAT_WRITE:0:12}..."
echo ""
echo "Usage:"
echo "  git remote set-url origin https://yj000018:\${GITHUB_PAT_WRITE}@github.com/yj000018/yos-cockpit.git"
echo "  git push origin main"
