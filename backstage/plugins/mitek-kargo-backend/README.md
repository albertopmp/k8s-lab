# mitek-kargo-backend

Mitek Kargo integration for the Backstage backend. One package, two features:

| Export | What it adds |
|---|---|
| default (`mitekKargoPlugin`) | Routes at `/api/mitek-kargo` used by the `mitek-kargo` frontend fields |
| `mitekKargoScaffolderModule` | The `mitek:kargo:promote` scaffolder action |

Routes:

- `GET /projects/:project/warehouses/:warehouse/freight?limit=` newest Freight of a Warehouse (default 10)
- `GET /projects/:project/freight/:freight/stages` Stages the Freight can be promoted to (Kargo decides per Stage)

Action (`mitek:kargo:promote`): inputs `entityRef`, `freight`, `stage`,
`timeoutMinutes` (default 10). Checks the Freight belongs to the component and
that Kargo accepts it in the Stage, promotes it, logs each phase and waits
until it finishes. Failures fail the step with a readable message.

Files: `MitekKargoClient.ts` (Kargo REST API), `MitekKargoError.ts`,
`router.ts` + `plugin.ts`, `promoteAction.ts` + `scaffolderModule.ts`.

```yaml
mitek:
  kargo:
    baseUrl: http://kargo-api.apps-prd.svc.cluster.local
    token: ${KARGO_API_TOKEN}   # kargo-promoter API token
    uiUrl: http://localhost:8081
```
