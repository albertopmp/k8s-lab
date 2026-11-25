import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
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
        actions: scaffolderActionsExtensionPoint,
      },
      async init({ config, catalog, actions }) {
        actions.addActions(createPromoteAction(MitekKargoClient.fromConfig(config), catalog));
      },
    });
  },
});
