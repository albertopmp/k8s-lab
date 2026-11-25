import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { FormFieldBlueprint } from '@backstage/plugin-scaffolder-react/alpha';

/** Mitek: `MitekFreightPicker` field for software templates. */
export const mitekFreightPickerFormField = FormFieldBlueprint.make({
  name: 'mitek-freight-picker',
  params: {
    field: () =>
      import('./components/MitekFreightPicker').then(
        m => m.mitekFreightPickerField,
      ),
  },
});

/**
 * Mitek: frontend plugin for Kargo. Data comes from the mitek-kargo backend
 * plugin (@internal/backstage-plugin-mitek-kargo-backend).
 */
export const mitekKargoPlugin = createFrontendPlugin({
  pluginId: 'mitek-kargo',
  info: { packageJson: () => import('../package.json') },
  extensions: [mitekFreightPickerFormField],
});
