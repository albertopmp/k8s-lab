import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { FormFieldBlueprint } from '@backstage/plugin-scaffolder-react/alpha';

/**
 * Mitek: frontend plugin for Kargo. Adds two scaffolder fields,
 * `MitekFreightPicker` and `MitekStagePicker`, backed by mitek-kargo-backend.
 */
export const mitekKargoPlugin = createFrontendPlugin({
  pluginId: 'mitek-kargo',
  info: { packageJson: () => import('../package.json') },
  extensions: [
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
