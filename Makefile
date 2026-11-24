SHELL := /bin/sh
.PHONY: up down status argocd-ui backstage-ui backstage-image argocd-password secrets

PROFILE ?= k8s-lab
BACKSTAGE_TAG ?= 0.1.3
K8S_VERSION ?= v1.34.0
CPUS ?= 4
MEMORY ?= 4096
KUBECTL = minikube kubectl -p "$(PROFILE)" --

up:
	@command -v minikube >/dev/null 2>&1 || { echo "Minikube is required." >&2; exit 1; }
	@command -v helm >/dev/null 2>&1 || { echo "Helm is required. Install it with: brew install helm" >&2; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "Docker Desktop and its CLI are required." >&2; exit 1; }
	@command -v yarn >/dev/null 2>&1 || { echo "Yarn is required to build the Backstage image." >&2; exit 1; }
	@test -f secrets.local.yaml || { echo "Create secrets.local.yaml from secrets.local.example.yaml and fill in the placeholders." >&2; exit 1; }
	@if grep -q 'REPLACE_ME' secrets.local.yaml; then echo "Fill in every REPLACE_ME value in secrets.local.yaml before running make up." >&2; exit 1; fi
	minikube start --profile "$(PROFILE)" --driver=docker --container-runtime=containerd --kubernetes-version="$(K8S_VERSION)" --cpus="$(CPUS)" --memory="$(MEMORY)"
	helm repo add argo https://argoproj.github.io/argo-helm --force-update
	helm dependency build ./charts/argocd
	helm --kube-context "$(PROFILE)" upgrade --install argocd charts/argocd --namespace argocd --create-namespace --wait --timeout 10m
	$(MAKE) secrets PROFILE="$(PROFILE)"
	$(MAKE) backstage-image PROFILE="$(PROFILE)" BACKSTAGE_TAG="$(BACKSTAGE_TAG)"
	$(KUBECTL) wait --for=condition=Available --timeout=5m -n argocd deployment/argocd-server
	$(KUBECTL) apply -f argocd/appset.yaml
	@attempt=0; until $(KUBECTL) -n backstage get deployment/backstage >/dev/null 2>&1; do \
		attempt=$$((attempt + 1)); \
		if [ $$attempt -ge 120 ]; then echo "Timed out waiting for Argo CD to create the Backstage deployment." >&2; exit 1; fi; \
		sleep 5; \
	done
	$(KUBECTL) -n backstage rollout status deployment/backstage --timeout=10m

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
	cd backstage && corepack yarn install --immutable && corepack yarn tsc && corepack yarn build:backend
	DOCKER_BUILDKIT=1 docker image build -f backstage/packages/backend/Dockerfile --tag k8s-lab/backstage:$(BACKSTAGE_TAG) backstage
	minikube image load --profile "$(PROFILE)" k8s-lab/backstage:$(BACKSTAGE_TAG)

secrets:
	@test -f secrets.local.yaml || { echo "Create secrets.local.yaml from secrets.local.example.yaml and fill in the placeholders." >&2; exit 1; }
	@if grep -q 'REPLACE_ME' secrets.local.yaml; then echo "Fill in every REPLACE_ME value in secrets.local.yaml before applying it." >&2; exit 1; fi
	$(KUBECTL) apply -f secrets.local.yaml
	sh ./scripts/set-argocd-lab-password.sh "$(PROFILE)"

argocd-password:
	$(KUBECTL) -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode; printf '\n'
