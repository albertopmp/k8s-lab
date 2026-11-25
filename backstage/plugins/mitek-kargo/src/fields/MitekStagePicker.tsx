import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import { useMitekKargo } from '../useMitekKargo';
import { formValue, KargoSelect } from './KargoSelect';

type Options = { entityField?: string; freightField?: string };

/**
 * Mitek: the Kargo Stages the Freight chosen in another field can be promoted
 * to (`ui:options.entityField` / `freightField`, defaults `component` /
 * `freight`). Kargo decides, e.g. prd only once verified in stg.
 */
function MitekStagePicker(field: FieldExtensionComponentProps<string, Options>) {
  const kargo = useMitekKargo();
  const options = field.uiSchema['ui:options'];
  const entityRef = formValue(field, options?.entityField ?? 'component');
  const freight = formValue(field, options?.freightField ?? 'freight');

  return (
    <KargoSelect
      field={field}
      dependsOn={entityRef && freight ? `${entityRef}/${freight}` : undefined}
      load={async () =>
        (await kargo.listStages(entityRef!, freight!)).map(s => ({ value: s, label: s }))
      }
      texts={{
        waiting: 'Select a component and Freight first',
        loading: 'Checking where this Freight can go…',
        empty: 'No Stage accepts this Freight right now',
      }}
    />
  );
}

export const mitekStagePickerField = createFormField({
  name: 'MitekStagePicker',
  component: MitekStagePicker,
});
