#!/bin/sh
set -eu

context=${1:-k8s-lab}
password=${ARGOCD_LAB_PASSWORD:-lab123}

hash=$(minikube kubectl -p "$context" -- -n argocd exec deployment/argocd-server -- \
  argocd account bcrypt --password "$password" | tail -n 1)
if [ -z "$hash" ]; then
  echo "Could not generate bcrypt password hash" >&2
  exit 1
fi

minikube kubectl -p "$context" -- -n argocd patch secret argocd-secret --type merge \
  -p "{\"stringData\":{\"accounts.lab.password\":\"$hash\"}}" >/dev/null
minikube kubectl -p "$context" -- -n argocd rollout restart deployment/argocd-server >/dev/null
minikube kubectl -p "$context" -- -n argocd rollout status deployment/argocd-server --timeout=5m

echo "Argo CD user 'lab' password configured."
