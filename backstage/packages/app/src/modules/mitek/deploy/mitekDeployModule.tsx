import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

/**
 * Mitek: Deploy card for the entity Overview tab.
 * Placement (`type`) and which entities show it (`filter`) are set in app-config.yaml.
 */
const mitekDeployCard = EntityCardBlueprint.make({
  name: 'mitek-deploy',
  params: {
    loader: () =>
      import('./MitekDeployCard').then(m => <m.MitekDeployCard />),
  },
});

export const mitekDeployModule = createFrontendModule({
  pluginId: 'app',
  extensions: [mitekDeployCard],
});
