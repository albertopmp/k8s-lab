SHELL := /bin/sh
.PHONY: up down status argocd-ui backstage-ui backstage-image backstage-argocd-secret argocd-password argocd-lab-password repo-auth

PROFILE ?= k8s-lab
BACKSTAGE_TAG ?= 0.1.2
K8S_VERSION ?= v1.34.0
CPUS ?= 4
MEMORY ?= 4096
ARGOCD_LAB_PASSWORD ?= lab123
KUBECTL = minikube kubectl -p "$(PROFILE)" --

up:
	@command -v helm >/dev/null 2>&1 || { echo "Helm is required. Install it with: brew install helm" >&2; exit 1; }
	minikube start --profile "$(PROFILE)" --driver=docker --container-runtime=containerd --kubernetes-version="$(K8S_VERSION)" --cpus="$(CPUS)" --memory="$(MEMORY)"
	helm repo add argo https://argoproj.github.io/argo-helm --force-update
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

backstage-ui:
	$(KUBECTL) -n backstage port-forward svc/backstage 7007:7007

backstage-image:
	cd backstage && yarn install --immutable && yarn tsc && yarn build:backend
	DOCKER_BUILDKIT=1 docker image build -f backstage/packages/backend/Dockerfile --tag k8s-lab/backstage:$(BACKSTAGE_TAG) backstage
	minikube image load --profile "$(PROFILE)" k8s-lab/backstage:$(BACKSTAGE_TAG)

backstage-argocd-secret:
	ARGOCD_LAB_PASSWORD="$(ARGOCD_LAB_PASSWORD)" sh ./scripts/set-backstage-argocd-secret.sh "$(PROFILE)"

argocd-password:
	$(KUBECTL) -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode; printf '\n'

argocd-lab-password:
	@printf '%s\n' "$(ARGOCD_LAB_PASSWORD)"

repo-auth:
	bash ./scripts/register-gitops-repo.sh "$(PROFILE)"
