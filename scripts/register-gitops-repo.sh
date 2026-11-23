#!/usr/bin/env bash
set -euo pipefail

profile=${1:-k8s-lab}
repo_url="https://github.com/albertopmp/k8s-lab.git"
read -r -p "GitHub username [albertopmp]: " username
username=${username:-albertopmp}
read -r -s -p "Read-only token for albertopmp/k8s-lab: " token
printf '\n'
if [[ -z "$token" ]]; then
  echo "A GitHub token is required for this private repository." >&2
  exit 1
fi

encoded_type=$(printf '%s' git | base64 | tr -d '\n')
encoded_url=$(printf '%s' "$repo_url" | base64 | tr -d '\n')
encoded_username=$(printf '%s' "$username" | base64 | tr -d '\n')
encoded_token=$(printf '%s' "$token" | base64 | tr -d '\n')
unset token

minikube kubectl -p "$profile" -- apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: k8s-lab-repo
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
type: Opaque
data:
  type: ${encoded_type}
  url: ${encoded_url}
  username: ${encoded_username}
  password: ${encoded_token}
EOF

echo "Argo CD can now read $repo_url."
