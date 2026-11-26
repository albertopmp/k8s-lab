import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { notificationService } from '@backstage/plugin-notifications-node';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { MitekKargoClient } from './MitekKargoClient';
import { createPromoteAction } from './promoteAction';

/** Mitek: adds the `mitek:kargo:promote` action to the scaffolder. */
export const mitekKargoScaffolderModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'mitek-kargo',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        catalog: catalogServiceRef,
        notifications: notificationService,
        actions: scaffolderActionsExtensionPoint,
      },
      async init({ config, catalog, notifications, actions }) {
        actions.addActions(
          createPromoteAction(MitekKargoClient.fromConfig(config), catalog, notifications),
        );
      },
    });
  },
});
