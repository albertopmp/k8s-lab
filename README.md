# Local Kubernetes lab

A disposable, code-defined Minikube cluster for practicing Kubernetes, Helm, and Argo CD. This starter targets macOS with Docker Desktop, Minikube, kubectl, and Helm installed. The cluster uses the Docker driver and containerd. Argo CD is installed through a local wrapper chart that pins the upstream chart version to `10.18.2`.

## Prerequisites

- Docker Desktop running
- Minikube
- kubectl
- Helm (for chart work from your terminal)
- GNU Make

Install the command line tools with Homebrew if needed: `brew install minikube kubectl helm`. Install Docker Desktop separately.

## Create the environment

```sh
make up
```

The default profile is `k8s-lab`, Kubernetes is pinned to `v1.34.0`, and the cluster gets 4 CPUs and 4 GiB RAM. Override these when creating it, for example `make up PROFILE=demo K8S_VERSION=v1.33.0 MEMORY=6144`. Minikube creates or reuses that named profile; `make down PROFILE=demo` deletes only the selected profile.

Check the cluster using Minikube's kubectl client, which matches the Kubernetes version in the profile:

```sh
make status
minikube kubectl -p k8s-lab -- get nodes
```

## Argo CD

`make up` builds the pinned dependency in [charts/argocd/Chart.yaml](charts/argocd/Chart.yaml), installs it using [charts/argocd/values.yaml](charts/argocd/values.yaml), configures the local `lab` account, and applies one parent [ApplicationSet](argocd/appset.yaml). The ApplicationSet reads `argocd/apps/*/app.yaml` from Git and creates one Application per folder. App definitions and catalog descriptors are kept together under `argocd/apps/`. The default test password is `lab123`; override it with `make up ARGOCD_LAB_PASSWORD='your-test-password'`. The user has Argo CD admin permissions for easy local experimentation. Edit the wrapper chart's values file to customize the upstream Argo CD chart. See the [upstream values](https://github.com/argoproj/argo-helm/blob/main/charts/argo-cd/values.yaml) for available settings. Guestbook is configured with 2 replicas and Podinfo with 3.

Backstage is installed from the pinned official [Backstage Helm chart](argocd/apps/backstage/app.yaml). Its project is scaffolded from the [Backstage quickstart](https://backstage.io/docs/getting-started/) in `backstage/`, with one `app-config.yaml` for this local lab. Build the custom image into Minikube with `make backstage-image`; this builds tag `0.1.1` by default. Argo CD deploys that local image through the Helm chart. The app uses in-memory SQLite and guest access for local evaluation; its database is lost when the pod restarts. Start a local UI tunnel with `make backstage-ui`, then open <http://localhost:7007>. Guest access is intended only for this local lab. The `catalog-info.yaml` files beside each app definition describe the apps as Backstage Components for later manual registration.

In one terminal, start the UI tunnel:

```sh
make argocd-ui
```

Open <http://localhost:8080> and sign in as `lab` using the test password above. The initial admin account remains available for recovery:

```sh
make argocd-password
```

Log in as `admin`. This default credential is only suitable for this disposable local cluster.

## Practice Helm directly

The sample is managed by Argo CD. For a separate hands-on Helm release, use a scratch namespace:

```sh
helm create my-chart
helm upgrade --install my-chart ./my-chart --namespace helm-practice --create-namespace
helm list --namespace helm-practice
helm uninstall my-chart --namespace helm-practice
```

## Tear down

```sh
make down
```

Deleting the Minikube profile removes the cluster, including Argo CD and all workloads. The repository remains as the reproducible source of the setup.

## Notes

- This is a single-node local learning environment, not a production configuration. The `lab` account is deliberately granted admin access and uses a simple test password; do not expose this cluster or reuse that password elsewhere.
- The ApplicationSet reads this private repository at `https://github.com/albertopmp/k8s-lab`, branch `master`. Create a GitHub fine-grained token with Contents: Read-only for this repo. `make up` prompts for it without echoing the token, then stores it in an Argo CD repository Secret; to refresh credentials later, run `make repo-auth`. Each `argocd/apps/<name>/app.yaml` folder becomes one generated Argo CD Application.
- The Backstage Helm chart deployment is a disposable demo. The Getting Started guide's in-memory SQLite database is not durable; use a production database and configured authentication before exposing it beyond localhost.
- Kubernetes and the upstream Argo CD chart are version-pinned. To change them, edit the Makefile Kubernetes default or the dependency version in `charts/argocd/Chart.yaml`.
