#!/usr/bin/env bash
set -euo pipefail

profile=${1:-k8s-lab}
read -r -p "GitHub OAuth App client ID: " client_id
read -r -s -p "GitHub OAuth App client secret: " client_secret
printf '\n'

if [[ -z "$client_id" || -z "$client_secret" ]]; then
  echo "Both GitHub OAuth values are required." >&2
  exit 1
fi

patch_file=$(mktemp)
trap 'rm -f "$patch_file"' EXIT
GITHUB_CLIENT_ID="$client_id" GITHUB_CLIENT_SECRET="$client_secret" python3 - <<'PY' > "$patch_file"
import json
import os

print(json.dumps({
    "stringData": {
        "AUTH_GITHUB_CLIENT_ID": os.environ["GITHUB_CLIENT_ID"],
        "AUTH_GITHUB_CLIENT_SECRET": os.environ["GITHUB_CLIENT_SECRET"],
    }
}))
PY
unset client_id client_secret

minikube kubectl -p "$profile" -- -n backstage patch secret backstage-argocd \
  --type merge --patch-file "$patch_file" >/dev/null

echo "Stored GitHub OAuth credentials in backstage-argocd."
