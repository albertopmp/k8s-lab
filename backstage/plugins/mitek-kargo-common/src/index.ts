/**
 * Mitek: types and constants shared by the mitek-kargo frontend and backend.
 *
 * @packageDocumentation
 */

/**
 * Catalog annotation naming the Kargo Project that holds a component's
 * Warehouse. The Warehouse is named after the component (its app directory).
 *
 * @public
 */
export const MITEK_KARGO_PROJECT_ANNOTATION = 'kargo/project';

/**
 * Freight as served by the mitek-kargo backend: only the fields Backstage uses.
 *
 * @public
 */
export type MitekFreight = {
  name: string;
  alias?: string;
  commits: { id: string; message?: string }[];
};

/**
 * Response of `GET /projects/:project/warehouses/:warehouse/freight`.
 *
 * @public
 */
export type MitekFreightList = { items: MitekFreight[] };

/**
 * Response of `GET /projects/:project/freight/:freight/stages`: Stage names.
 *
 * @public
 */
export type MitekStageList = { items: string[] };

/**
 * A Kargo Promotion: only the fields Backstage uses.
 *
 * @public
 */
export type MitekPromotion = {
  name: string;
  /** Pending, Running, Succeeded, Failed, Errored or Aborted; empty at first. */
  phase?: string;
  message?: string;
};
