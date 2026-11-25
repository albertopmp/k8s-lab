import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { FormFieldBlueprint } from '@backstage/plugin-scaffolder-react/alpha';

/**
 * Mitek: frontend plugin for Kargo, backed by mitek-kargo-backend.
 *
 * - entity-card:mitek-kargo/deploy: "Deploy" button on the entity Overview
 *   (placement and filter set in app-config.yaml)
 * - MitekFreightPicker and MitekStagePicker scaffolder fields
 */
export const mitekKargoPlugin = createFrontendPlugin({
  pluginId: 'mitek-kargo',
  info: { packageJson: () => import('../package.json') },
  extensions: [
    EntityCardBlueprint.make({
      name: 'deploy',
      params: {
        loader: () => import('./cards/MitekDeployCard').then(m => <m.MitekDeployCard />),
      },
    }),
    FormFieldBlueprint.make({
      name: 'mitek-freight-picker',
      params: {
        field: () => import('./fields/MitekFreightPicker').then(m => m.mitekFreightPickerField),
      },
    }),
    FormFieldBlueprint.make({
      name: 'mitek-stage-picker',
      params: {
        field: () => import('./fields/MitekStagePicker').then(m => m.mitekStagePickerField),
      },
    }),
  ],
});
