# Local Kubernetes lab

A disposable, code-defined Minikube cluster for practicing Kubernetes, Helm, and Argo CD. This starter targets macOS with Docker Desktop, Minikube, kubectl, and Helm installed. The cluster uses the Docker driver and containerd. Argo CD is installed through a local wrapper chart that pins the upstream chart version to `10.18.2`.

## Prerequisites

- Docker Desktop running
- Minikube
- kubectl
- Helm (for chart work from your terminal)
- Node.js and Yarn (to build Backstage)
- GNU Make

Install the command line tools with Homebrew if needed: `brew install minikube kubectl helm node`. Enable Corepack to get Yarn. Install Docker Desktop separately.

## Create the environment

```sh
cp secrets.local.example.yaml secrets.local.yaml
# Edit secrets.local.yaml, replace all REPLACE_ME values, then keep this file private.
chmod 600 secrets.local.yaml
make up
```

The default profile is `k8s-lab`, Kubernetes is pinned to `v1.34.0`, and the cluster gets 4 CPUs and 4 GiB RAM. Override these when creating it, for example `make up PROFILE=demo K8S_VERSION=v1.33.0 MEMORY=6144`. Minikube creates or reuses that named profile; `make down PROFILE=demo` deletes only the selected profile.

Check the cluster using Minikube's kubectl client, which matches the Kubernetes version in the profile:

```sh
make status
minikube kubectl -p k8s-lab -- get nodes
```

## Argo CD

`make up` reads credentials from the ignored `secrets.local.yaml`, installs Argo CD, applies the Kubernetes Secrets from that file, configures its local `lab` account, builds the Backstage image, applies the parent [ApplicationSet](argocd/appset.yaml), and waits for Backstage. The ApplicationSet reads every `argocd/apps/<app>/<env>.yaml` from Git (`dev.yaml`, `stg.yaml`, `prd.yaml`) and creates one Application per file; all instances of an app share the folder's `catalog-info.yaml`. Everything identifying an instance is calculated from its path: Application name `<app>-<env>`, namespace `apps-<env>` (shared by all apps of that environment), and labels `k8s-lab/instance-of=<app>` and `k8s-lab/environment=<env>`. The env files only hold the source and Helm values. App definitions and catalog descriptors are kept together under `argocd/apps/`. The local `lab` account uses the password in `secrets.local.yaml`; it has Argo CD admin permissions for easy local experimentation. Edit the wrapper chart's values file to customize the upstream Argo CD chart. See the [upstream values](https://github.com/argoproj/argo-helm/blob/main/charts/argo-cd/values.yaml) for available settings. Guestbook runs as three instances, each pinned to a different upstream revision: `guestbook-prd` (2 replicas), `guestbook-stg` and `guestbook-dev` (1 each). Podinfo (`podinfo-prd`, 3 replicas) and Backstage (`backstage-prd`) have only a `prd.yaml`, so they run in `apps-prd`. Each catalog entry finds its instances with the `argocd/app-selector` annotation.

Backstage is installed from the pinned official [Backstage Helm chart](argocd/apps/backstage/prd.yaml). Its project is scaffolded from the [Backstage quickstart](https://backstage.io/docs/getting-started/) in `backstage/`, with one `app-config.yaml` for this local lab. `make up` builds the custom image into Minikube using the tag set by `BACKSTAGE_TAG` (currently `0.1.6`). Argo CD deploys that local image through the Helm chart. The app uses guest access for local evaluation. Its database is the chart's bundled PostgreSQL on an 8Gi PVC, so registered entities survive pod restarts (but not `make down`); the database passwords live in the `backstage-postgresql-auth` Secret in `secrets.local.yaml`. Start the local UI tunnels with `make ui`, which opens <http://localhost:8080> (Argo CD) and <http://localhost:7007> (Backstage). Guest access is intended only for this local lab. `secrets.local.yaml` contains the Argo CD repository credential and Backstage environment Secrets; `make up` applies them directly. The file survives deleting Minikube, and its Secrets are recreated on the next `make up`. The `catalog-info.yaml` files beside each app definition describe the apps as Backstage Components for later registration and include Argo CD app annotations.

The Backstage frontend also includes the [GitHub Actions plugin](https://github.com/backstage/community-plugins/blob/main/workspaces/github/plugins/github-actions/README.md), and its GitHub auth backend provider is installed. Components use `github.com/project-slug` to identify their repository; the lab app descriptors point to `albertopmp/k8s-lab`. Put your GitHub OAuth App client ID and secret in `secrets.local.yaml`; the callback URL is `http://localhost:7007/api/auth/github/handler/frame`. The same file holds a fine-grained GitHub token with Contents: Read and Actions: Read access, plus a local Argo CD lab password. `make up` applies the file directly, and `make secrets` reapplies it after you edit a credential. The GitHub Actions plugin can show runs from the repository. The added `.github/workflows/lab-smoke.yaml` runs on pushes, pull requests, or manual dispatch, giving the plugin a simple workflow to display after it runs.

In one terminal, start the UI tunnels (CTRL-C stops both):

```sh
make ui
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
- The ApplicationSet reads this private repository at `https://github.com/albertopmp/k8s-lab`, branch `master`. `secrets.local.yaml` contains the fine-grained GitHub token with Contents: Read access; `make up` applies the Argo CD repository Secret from it. After changing credentials in the local file, run `make secrets` to apply them. Each `argocd/apps/<app>/<env>.yaml` becomes one generated Argo CD Application. Changes to `argocd/appset.yaml` itself are not synced from Git: reapply it with `kubectl --context k8s-lab apply -f argocd/appset.yaml`.
- `secrets.local.yaml` is ignored by Git and contains plaintext local test values. It is not encrypted or backed up by Kubernetes; protect the file and store your own secure backup if you need it on another machine.
- The Backstage Helm chart deployment is a disposable demo. The Getting Started guide's in-memory SQLite database is not durable; use a production database and configured authentication before exposing it beyond localhost.
- Kubernetes and the upstream Argo CD chart are version-pinned. To change them, edit the Makefile Kubernetes default or the dependency version in `charts/argocd/Chart.yaml`.
