import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { MitekKargoClient } from './MitekKargoClient';
import { createRouter } from './router';

/**
 * Mitek: backend plugin exposing Kargo data to Backstage at /api/mitek-kargo.
 *
 * Config:
 *   mitek:
 *     kargo:
 *       baseUrl: http://kargo-api.apps-prd.svc.cluster.local
 *       token: ${KARGO_API_TOKEN}
 */
export const mitekKargoPlugin = createBackendPlugin({
  pluginId: 'mitek-kargo',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
      },
      async init({ config, logger, httpRouter }) {
        const baseUrl = config.getOptionalString('mitek.kargo.baseUrl');
        const token = config.getOptionalString('mitek.kargo.token');
        if (!baseUrl || !token) {
          logger.warn('Kargo is not configured; /api/mitek-kargo returns 503');
        }
        const client =
          baseUrl && token
            ? new MitekKargoClient({ baseUrl: baseUrl.replace(/\/$/, ''), token })
            : undefined;
        httpRouter.use(createRouter({ client, logger }));
      },
    });
  },
});
