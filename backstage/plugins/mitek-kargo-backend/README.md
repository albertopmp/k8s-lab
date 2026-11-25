# mitek-kargo-backend

Mitek backend plugin that serves Kargo data to Backstage at `/api/mitek-kargo`:

- `GET /projects/:project/freight`
- `GET /projects/:project/warehouses/:warehouse/freight`

Calls the Kargo REST API (`/v1beta1`) with a read-only Kargo API token.

```yaml
mitek:
  kargo:
    baseUrl: http://kargo-api.apps-prd.svc.cluster.local
    token: ${KARGO_API_TOKEN}
```

Returns 503 when not configured. `yarn start` runs it standalone (see `dev/index.ts`).
