#!/usr/bin/env bash
set -euo pipefail

profile=${1:-k8s-lab}
username=${ARGOCD_USERNAME:-lab}
password=${ARGOCD_LAB_PASSWORD:-lab123}

if [[ -z "$password" ]]; then
  echo "ARGOCD_LAB_PASSWORD must not be empty." >&2
  exit 1
fi

encoded_username=$(printf '%s' "$username" | base64 | tr -d '\n')
encoded_password=$(printf '%s' "$password" | base64 | tr -d '\n')
unset password

minikube kubectl -p "$profile" -- create namespace backstage --dry-run=client -o yaml |
  minikube kubectl -p "$profile" -- apply -f -

minikube kubectl -p "$profile" -- apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: backstage-argocd
  namespace: backstage
type: Opaque
data:
  ARGOCD_USERNAME: ${encoded_username}
  ARGOCD_PASSWORD: ${encoded_password}
EOF

echo "Created backstage-argocd in namespace backstage."
