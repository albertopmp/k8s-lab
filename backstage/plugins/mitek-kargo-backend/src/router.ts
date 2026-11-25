import express from 'express';
import Router from 'express-promise-router';
import type { LoggerService } from '@backstage/backend-plugin-api';
import type {
  MitekFreightList,
  MitekStageList,
} from '@internal/backstage-plugin-mitek-kargo-common';
import { MitekKargoError } from './MitekKargoError';
import type { MitekKargoClient } from './MitekKargoClient';

/**
 * Mitek: routes of the mitek-kargo plugin, served at /api/mitek-kargo.
 *
 *   GET /projects/:project/warehouses/:warehouse/freight  10 newest Freight of a Warehouse
 *   GET /projects/:project/freight/:freight/stages        Stages the Freight can be promoted to
 *
 * Errors are `{ error }`: Kargo's 4xx status, 502 if Kargo fails, 503 if
 * Kargo isn't configured.
 */
export function createRouter(client: MitekKargoClient | undefined, logger: LoggerService) {
  const router = Router();

  router.use((_req, res, next) => {
    if (client) return next();
    return res.status(503).json({
      error: 'Kargo is not configured (mitek.kargo.baseUrl / mitek.kargo.token)',
    });
  });

  router.get('/projects/:project/warehouses/:warehouse/freight', async (req, res) => {
    const { project, warehouse } = req.params;
    const body: MitekFreightList = {
      items: await client!.listFreight(project, { warehouse, limit: 10 }),
    };
    res.json(body);
  });

  router.get('/projects/:project/freight/:freight/stages', async (req, res) => {
    const { project, freight } = req.params;
    const body: MitekStageList = {
      items: await client!.getPromotableStages(project, freight),
    };
    res.json(body);
  });

  router.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.warn(`Kargo request failed: ${err.message}`);
    const isKargo4xx = err instanceof MitekKargoError && err.status !== undefined && err.status < 500;
    res.status(isKargo4xx ? (err as MitekKargoError).status! : 502).json({ error: err.message });
  });

  return router;
}
