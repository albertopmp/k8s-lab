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
  /** Stages currently running this Freight. */
  currentlyIn: string[];
};

/**
 * Response body of the mitek-kargo Freight endpoints.
 *
 * @public
 */
export type MitekFreightList = { items: MitekFreight[] };

/**
 * A Stage this Freight can be promoted to.
 *
 * @public
 */
export type MitekStage = { name: string };

/**
 * Response body of the promotable-Stages endpoint.
 *
 * @public
 */
export type MitekStageList = { items: MitekStage[] };

/**
 * Lifecycle phase of a Kargo Promotion.
 *
 * @public
 */
export type MitekPromotionPhase =
  | 'Pending'
  | 'Running'
  | 'Succeeded'
  | 'Failed'
  | 'Errored'
  | 'Aborted';


/**
 * A Kargo Promotion: only the fields Backstage uses.
 *
 * @public
 */
export type MitekPromotion = {
  name: string;
  stage: string;
  freight: string;
  /** Empty until the Kargo controller picks the Promotion up. */
  phase?: MitekPromotionPhase;
  message?: string;
  createdAt?: string;
};
