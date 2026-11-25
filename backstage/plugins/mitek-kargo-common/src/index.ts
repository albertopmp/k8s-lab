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
 * A Git commit referenced by a Freight.
 *
 * @public
 */
export type MitekFreightCommit = {
  id: string;
  message?: string;
  branch?: string;
  repoURL?: string;
};

/**
 * Freight as served by the mitek-kargo backend: only the fields Backstage uses.
 *
 * @public
 */
export type MitekFreight = {
  name: string;
  alias?: string;
  /** Warehouse the Freight came from. */
  warehouse: string;
  createdAt?: string;
  commits: MitekFreightCommit[];
  /** Stages where this Freight has been verified (e.g. dev, stg, prd). */
  verifiedIn: string[];
};

/**
 * Response body of the mitek-kargo Freight endpoints.
 *
 * @public
 */
export type MitekFreightList = { items: MitekFreight[] };
