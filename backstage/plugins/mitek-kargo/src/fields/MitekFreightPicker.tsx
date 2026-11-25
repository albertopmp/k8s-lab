import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import type { MitekFreight } from '@internal/backstage-plugin-mitek-kargo-common';
import { useMitekKargo } from '../useMitekKargo';
import { formValue, KargoSelect } from './KargoSelect';

/** e.g. "innocent-shark · b6d3953 · Deploy Kargo (in dev, stg)" */
function describe(f: MitekFreight) {
  const commit = f.commits[0];
  const parts = [f.alias ?? f.name.slice(0, 7), commit?.id.slice(0, 7), commit?.message];
  const where = f.currentlyIn.length ? ` (in ${f.currentlyIn.join(', ')})` : '';
  return parts.filter(Boolean).join(' · ') + where;
}

/**
 * Mitek: the 10 newest Kargo Freight of the component chosen in another field
 * (`ui:options.entityField`, default `component`). Stores the Freight name.
 */
function MitekFreightPicker(field: FieldExtensionComponentProps<string, { entityField?: string }>) {
  const kargo = useMitekKargo();
  const entityRef = formValue(field, field.uiSchema['ui:options']?.entityField ?? 'component');

  return (
    <KargoSelect
      field={field}
      dependsOn={entityRef}
      load={async () =>
        (await kargo.listFreight(entityRef!)).map(f => ({ value: f.name, label: describe(f) }))
      }
      texts={{
        waiting: 'Select a component first',
        loading: 'Loading Freight…',
        empty: 'No Freight for this component yet',
      }}
    />
  );
}

export const mitekFreightPickerField = createFormField({
  name: 'MitekFreightPicker',
  component: MitekFreightPicker,
});
