# mitek-kargo-backend

Mitek Kargo integration for the Backstage backend. One package, two features:

| Export | What it adds |
|---|---|
| default (`mitekKargoPlugin`) | Routes at `/api/mitek-kargo` used by the `mitek-kargo` frontend fields |
| `mitekKargoScaffolderModule` | The `mitek:kargo:promote` scaffolder action |

Routes:

- `GET /projects/:project/warehouses/:warehouse/freight?limit=` newest Freight of a Warehouse (default 10)
- `GET /projects/:project/freight/:freight/stages` Stages the Freight can be promoted to (Kargo decides per Stage)

Action (`mitek:kargo:promote`): inputs `entityRef`, `freight`, `stage`;
output `promotionUrl`. Reads the Kargo Project from the component, promotes,
logs each phase and waits up to 10 minutes. It doesn't repeat checks the form
already does: Kargo rejects invalid promotions and its message fails the step.

Files: `MitekKargoClient.ts` (Kargo REST API), `MitekKargoError.ts`,
`router.ts` + `plugin.ts`, `promoteAction.ts` + `scaffolderModule.ts`.

```yaml
mitek:
  kargo:
    baseUrl: http://kargo-api.apps-prd.svc.cluster.local
    token: ${KARGO_API_TOKEN}   # kargo-promoter API token
    uiUrl: http://localhost:8081
```
