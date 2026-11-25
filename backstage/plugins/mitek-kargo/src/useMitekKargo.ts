import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  MITEK_KARGO_PROJECT_ANNOTATION,
  type MitekFreightList,
  type MitekStageList,
} from '@internal/backstage-plugin-mitek-kargo-common';

/**
 * Mitek: calls to the mitek-kargo backend for a catalog component. The Kargo
 * Project comes from its `kargo/project` annotation; its name is the Warehouse.
 */
export function useMitekKargo() {
  const catalogApi = useApi(catalogApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  async function kargoComponent(entityRef: string) {
    const entity = await catalogApi.getEntityByRef(entityRef);
    const project = entity?.metadata.annotations?.[MITEK_KARGO_PROJECT_ANNOTATION];
    if (!entity || !project) {
      throw new Error(`${entityRef} has no ${MITEK_KARGO_PROJECT_ANNOTATION} annotation`);
    }
    return { project: encodeURIComponent(project), warehouse: encodeURIComponent(entity.metadata.name) };
  }

  async function get<T>(path: string): Promise<T> {
    const base = await discoveryApi.getBaseUrl('mitek-kargo');
    const res = await fetchApi.fetch(base + path);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Kargo request failed (${res.status})`);
    return body;
  }

  return {
    /** The component's 10 newest Freight. */
    async listFreight(entityRef: string) {
      const { project, warehouse } = await kargoComponent(entityRef);
      const body = await get<MitekFreightList>(`/projects/${project}/warehouses/${warehouse}/freight`);
      return body.items;
    },

    /** Stages the Freight can be promoted to, in promotion order. */
    async listStages(entityRef: string, freight: string) {
      const { project } = await kargoComponent(entityRef);
      const body = await get<MitekStageList>(
        `/projects/${project}/freight/${encodeURIComponent(freight)}/stages`,
      );
      return body.items.map(stage => stage.name);
    },
  };
}
