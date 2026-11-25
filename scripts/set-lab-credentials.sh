#!/bin/sh
# Sets up lab credentials derived from the Secrets in secrets.local.yaml:
# - Argo CD user `lab` and the Kargo `admin` account share ARGOCD_PASSWORD.
# - Kargo reads the private k8s-lab repo with the same GITHUB_TOKEN as Backstage.
# - Backstage reads Kargo and promotes Freight with the kargo-promoter API token of the k8s-lab Project.
set -eu

context=${1:-k8s-lab}
kubectl_mk() { minikube kubectl -p "$context" -- "$@"; }

password=$(kubectl_mk -n apps-prd get secret backstage-argocd -o jsonpath='{.data.ARGOCD_PASSWORD}' | base64 --decode)
if [ -z "$password" ]; then
  echo "ARGOCD_PASSWORD is missing from the backstage-argocd Secret." >&2
  exit 1
fi

hash=$(kubectl_mk -n argocd exec deployment/argocd-server -- \
  argocd account bcrypt --password "$password" | tail -n 1)
unset password
if [ -z "$hash" ]; then
  echo "Could not generate bcrypt password hash" >&2
  exit 1
fi

# Argo CD: user `lab`
kubectl_mk -n argocd patch secret argocd-secret --type merge \
  -p "{\"stringData\":{\"accounts.lab.password\":\"$hash\"}}" >/dev/null
kubectl_mk -n argocd rollout restart deployment/argocd-server >/dev/null
kubectl_mk -n argocd rollout status deployment/argocd-server --timeout=5m
echo "Argo CD user 'lab' password configured."

# Kargo: admin account (bcrypt hashes are accepted). Keep an existing token
# signing key so issued tokens stay valid across reruns.
signing_key=$(kubectl_mk -n apps-prd get secret kargo-admin -o jsonpath='{.data.ADMIN_ACCOUNT_TOKEN_SIGNING_KEY}' 2>/dev/null | base64 --decode || true)
if [ -z "$signing_key" ]; then
  signing_key=$(openssl rand -base64 48 | tr -d '=+/' | head -c 32)
fi
kubectl_mk apply -f - >/dev/null <<YAML
apiVersion: v1
kind: Secret
metadata:
  name: kargo-admin
  namespace: apps-prd
stringData:
  ADMIN_ACCOUNT_PASSWORD_HASH: '$hash'
  ADMIN_ACCOUNT_TOKEN_SIGNING_KEY: '$signing_key'
YAML
unset hash signing_key
if kubectl_mk -n apps-prd get deployment kargo-api >/dev/null 2>&1; then
  kubectl_mk -n apps-prd rollout restart deployment/kargo-api >/dev/null
fi
echo "Kargo admin password configured."

# Kargo: Git credentials for the k8s-lab Project (namespace labelled for Kargo
# to adopt when the Project is created).
token=$(kubectl_mk -n apps-prd get secret backstage-github-auth -o jsonpath='{.data.GITHUB_TOKEN}' | base64 --decode)
if [ -z "$token" ]; then
  echo "GITHUB_TOKEN is missing from the backstage-github-auth Secret." >&2
  exit 1
fi
kubectl_mk apply -f - >/dev/null <<YAML
apiVersion: v1
kind: Namespace
metadata:
  name: k8s-lab
  labels:
    kargo.akuity.io/project: "true"
---
apiVersion: v1
kind: Secret
metadata:
  name: k8s-lab-git
  namespace: k8s-lab
  labels:
    kargo.akuity.io/cred-type: git
stringData:
  repoURL: https://github.com/albertopmp/k8s-lab.git
  username: git
  password: '$token'
YAML
unset token
echo "Kargo Git credentials for k8s-lab configured."

# Backstage: Kargo API token (kargo-promoter ServiceAccount token
# declared in kargo/projects/k8s-lab). The Secret always exists so the
# Backstage pod can start; until Kargo has created the token it is empty and
# the mitek-kargo plugin answers 503. Rerun `make secrets` once Kargo is up.
kargo_token=$(kubectl_mk -n k8s-lab get secret backstage-kargo-token -o jsonpath='{.data.token}' 2>/dev/null | base64 --decode || true)
kubectl_mk apply -f - >/dev/null <<YAML
apiVersion: v1
kind: Secret
metadata:
  name: backstage-kargo
  namespace: apps-prd
stringData:
  KARGO_API_TOKEN: '$kargo_token'
YAML
if [ -n "$kargo_token" ]; then
  echo "Backstage Kargo API token configured."
else
  echo "Kargo API token not available yet; rerun 'make secrets' after Kargo syncs." >&2
fi
unset kargo_token
