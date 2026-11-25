import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { FormFieldBlueprint } from '@backstage/plugin-scaffolder-react/alpha';

/** Mitek: registers the `MitekGitTagPicker` field for software templates. */
const mitekGitTagPickerFormField = FormFieldBlueprint.make({
  name: 'mitek-git-tag-picker',
  params: {
    field: () =>
      import('./MitekGitTagPicker').then(m => m.mitekGitTagPickerField),
  },
});

export const mitekGitTagPickerModule = createFrontendModule({
  pluginId: 'app',
  extensions: [mitekGitTagPickerFormField],
});
