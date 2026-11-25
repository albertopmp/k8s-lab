import express from 'express';
import Router from 'express-promise-router';
import type { LoggerService } from '@backstage/backend-plugin-api';
import type { MitekFreightList } from '@internal/backstage-plugin-mitek-kargo-common';
import type { MitekKargoClient } from './MitekKargoClient';

/**
 * Mitek: HTTP routes of the mitek-kargo plugin, served at /api/mitek-kargo.
 *
 *   GET /projects/:project/freight                       all Freight
 *   GET /projects/:project/warehouses/:warehouse/freight  one Warehouse's Freight
 */
export function createRouter(options: {
  client?: MitekKargoClient;
  logger: LoggerService;
}): express.Router {
  const { client, logger } = options;
  const router = Router();
  router.use(express.json());

  router.use((_req, res, next) => {
    if (!client) {
      res.status(503).json({
        error: 'Kargo is not configured (mitek.kargo.baseUrl / mitek.kargo.token)',
      });
      return;
    }
    next();
  });

  router.get('/projects/:project/freight', async (req, res) => {
    const body: MitekFreightList = {
      items: await client!.listFreight(req.params.project),
    };
    res.json(body);
  });

  router.get(
    '/projects/:project/warehouses/:warehouse/freight',
    async (req, res) => {
      const { project, warehouse } = req.params;
      const body: MitekFreightList = {
        items: await client!.listFreight(project, warehouse),
      };
      res.json(body);
    },
  );

  router.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.warn(`Kargo request failed: ${err.message}`);
      res.status(502).json({ error: err.message });
    },
  );

  return router;
}
