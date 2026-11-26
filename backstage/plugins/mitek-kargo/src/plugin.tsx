import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { FormFieldBlueprint } from '@backstage/plugin-scaffolder-react/alpha';

/**
 * Mitek: frontend plugin for Kargo, backed by mitek-kargo-backend.
 *
 * - entity-card:mitek-kargo/promote: "Promote with Kargo" button on the entity
 *   Overview (placement and filter set in app-config.yaml)
 * - MitekFreightPicker, MitekStagePicker and MitekSecretsInput scaffolder fields
 */
export const mitekKargoPlugin = createFrontendPlugin({
  pluginId: 'mitek-kargo',
  info: { packageJson: () => import('../package.json') },
  extensions: [
    EntityCardBlueprint.make({
      name: 'promote',
      params: {
        loader: () => import('./cards/MitekPromoteCard').then(m => <m.MitekPromoteCard />),
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
    FormFieldBlueprint.make({
      name: 'mitek-secrets-input',
      params: {
        field: () => import('./fields/MitekSecretsInput').then(m => m.mitekSecretsInputField),
      },
    }),
  ],
});
