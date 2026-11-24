#!/bin/sh
set -eu

context=${1:-k8s-lab}
password=$(minikube kubectl -p "$context" -- -n backstage get secret backstage-argocd -o jsonpath='{.data.ARGOCD_PASSWORD}' | base64 --decode)
if [ -z "$password" ]; then
  echo "ARGOCD_PASSWORD is missing from the backstage-argocd Secret." >&2
  exit 1
fi

hash=$(minikube kubectl -p "$context" -- -n argocd exec deployment/argocd-server -- \
  argocd account bcrypt --password "$password" | tail -n 1)
unset password
if [ -z "$hash" ]; then
  echo "Could not generate bcrypt password hash" >&2
  exit 1
fi

minikube kubectl -p "$context" -- -n argocd patch secret argocd-secret --type merge \
  -p "{\"stringData\":{\"accounts.lab.password\":\"$hash\"}}" >/dev/null
minikube kubectl -p "$context" -- -n argocd rollout restart deployment/argocd-server >/dev/null
minikube kubectl -p "$context" -- -n argocd rollout status deployment/argocd-server --timeout=5m

echo "Argo CD user 'lab' password configured."
