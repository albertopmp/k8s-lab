SHELL := /bin/sh
.PHONY: up down status ui backstage-image argocd-password secrets

PROFILE ?= k8s-lab
BACKSTAGE_TAG ?= 0.1.6
K8S_VERSION ?= v1.34.0
CPUS ?= 4
MEMORY ?= 4096
KUBECTL = minikube kubectl -p "$(PROFILE)" --
# Long-running commands (port-forward) use kubectl directly when installed:
# `minikube kubectl` holds a minikube lock for as long as it runs, which makes
# every other `minikube kubectl` call print "Another minikube instance is
# downloading dependencies...".
KUBECTL_DIRECT = $(if $(shell command -v kubectl 2>/dev/null),kubectl --context "$(PROFILE)",$(KUBECTL))

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
	@attempt=0; until $(KUBECTL) -n apps-prd get deployment/backstage-prd >/dev/null 2>&1; do \
		attempt=$$((attempt + 1)); \
		if [ $$attempt -ge 120 ]; then echo "Timed out waiting for Argo CD to create the Backstage deployment." >&2; exit 1; fi; \
		sleep 5; \
	done
	$(KUBECTL) -n apps-prd rollout status deployment/backstage-prd --timeout=10m

down:
	minikube delete --profile "$(PROFILE)"

status:
	minikube status --profile "$(PROFILE)"
	$(KUBECTL) get nodes
	$(KUBECTL) get pods -A

ui:
	@$(KUBECTL_DIRECT) -n argocd port-forward svc/argocd-server 8080:80 >/dev/null & argocd=$$!; \
	$(KUBECTL_DIRECT) -n apps-prd port-forward svc/backstage-prd 7007:7007 >/dev/null & backstage=$$!; \
	trap 'kill $$argocd $$backstage 2>/dev/null' INT TERM EXIT; \
	sleep 2; open -a "Google Chrome" "http://localhost:8080" "http://localhost:7007"; \
	echo "Argo CD: http://localhost:8080  Backstage: http://localhost:7007"; \
	echo "Press CTRL-C to stop port forwarding."; \
	wait

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
