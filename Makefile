SHELL := /bin/sh
.PHONY: up down status argocd-ui argocd-password argocd-lab-password repo-auth

PROFILE ?= k8s-lab
K8S_VERSION ?= v1.34.0
CPUS ?= 4
MEMORY ?= 4096
ARGOCD_LAB_PASSWORD ?= lab123
KUBECTL = minikube kubectl -p "$(PROFILE)" --

up:
	@command -v helm >/dev/null 2>&1 || { echo "Helm is required. Install it with: brew install helm" >&2; exit 1; }
	minikube start --profile "$(PROFILE)" --driver=docker --container-runtime=containerd --kubernetes-version="$(K8S_VERSION)" --cpus="$(CPUS)" --memory="$(MEMORY)"
	helm dependency build ./charts/argocd
	helm --kube-context "$(PROFILE)" upgrade --install argocd charts/argocd --namespace argocd --create-namespace --wait --timeout 10m
	ARGOCD_LAB_PASSWORD="$(ARGOCD_LAB_PASSWORD)" sh ./scripts/set-argocd-lab-password.sh "$(PROFILE)"
	bash ./scripts/register-gitops-repo.sh "$(PROFILE)"
	$(KUBECTL) wait --for=condition=Available --timeout=5m -n argocd deployment/argocd-server
	$(KUBECTL) apply -f argocd/appset.yaml

down:
	minikube delete --profile "$(PROFILE)"

status:
	minikube status --profile "$(PROFILE)"
	$(KUBECTL) get nodes
	$(KUBECTL) get pods -A

argocd-ui:
	$(KUBECTL) -n argocd port-forward svc/argocd-server 8080:80

argocd-password:
	$(KUBECTL) -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode; printf '\n'

argocd-lab-password:
	@printf '%s\n' "$(ARGOCD_LAB_PASSWORD)"

repo-auth:
	bash ./scripts/register-gitops-repo.sh "$(PROFILE)"
