import { createBackend } from '@backstage/backend-defaults';
import { mockServices } from '@backstage/backend-test-utils';

// Mitek: standalone dev backend for the mitek-kargo plugin (`yarn start` in
// this package). Auth is mocked; Kargo settings come from app-config
// (mitek.kargo.baseUrl / mitek.kargo.token), e.g. with a port-forward:
//
//   kubectl -n apps-prd port-forward svc/kargo-api 8081:80
//   KARGO_API_TOKEN=... yarn start   (and baseUrl http://localhost:8081)
//
//   curl http://localhost:7007/api/mitek-kargo/projects/k8s-lab/warehouses/guestbook/freight

const backend = createBackend();
backend.add(mockServices.auth.factory());
backend.add(mockServices.httpAuth.factory());
backend.add(import('../src'));
backend.start();
