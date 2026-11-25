import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

/** Mitek: Deploy card on every Component's Overview, right column. */
const mitekDeployCard = EntityCardBlueprint.make({
  name: 'mitek-deploy',
  params: {
    type: 'info',
    filter: { kind: 'component' },
    loader: () =>
      import('./MitekDeployCard').then(m => <m.MitekDeployCard />),
  },
});

export const mitekDeployModule = createFrontendModule({
  pluginId: 'app',
  extensions: [mitekDeployCard],
});
