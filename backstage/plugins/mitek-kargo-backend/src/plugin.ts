import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { MitekKargoClient } from './MitekKargoClient';
import { createRouter } from './router';

/**
 * Mitek: backend plugin serving Kargo data to Backstage at /api/mitek-kargo.
 * Config: mitek.kargo.{baseUrl, token, uiUrl}.
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
        const client = MitekKargoClient.fromConfig(config);
        if (!client) logger.warn('Kargo is not configured; /api/mitek-kargo returns 503');
        httpRouter.use(createRouter(client, logger));
      },
    });
  },
});
