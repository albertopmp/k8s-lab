import { useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import {
  MITEK_KARGO_PROJECT_ANNOTATION,
  type MitekFreight,
  type MitekFreightList,
} from '@internal/backstage-plugin-mitek-kargo-common';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';

type UiOptions = {
  /** Form field holding the selected entity ref. Defaults to `component`. */
  entityField?: string;
};

type FreightState = { loading: boolean; items: MitekFreight[]; error?: string };

const label = (f: MitekFreight) => {
  const commit = f.commits[0];
  const parts = [f.alias ?? f.name.slice(0, 7)];
  if (commit) parts.push(commit.id.slice(0, 7), commit.message ?? '');
  return parts.filter(Boolean).join(' · ');
};

/**
 * Mitek: dropdown of the Kargo Freight of the Component selected in another
 * field. The Kargo Project comes from the component's `kargo/project`
 * annotation and the Warehouse is the component's name (its app directory).
 * Data comes from the mitek-kargo backend plugin. Stores the Freight name.
 */
export const MitekFreightPicker = (
  props: FieldExtensionComponentProps<string, UiOptions>,
) => {
  const { formData, onChange, schema, uiSchema, required, rawErrors } = props;
  const entityField = uiSchema['ui:options']?.entityField ?? 'component';
  const entityRef = props.formContext?.formData?.[entityField] as
    | string
    | undefined;

  const catalogApi = useApi(catalogApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [state, setState] = useState<FreightState>({
    loading: false,
    items: [],
  });

  useEffect(() => {
    if (!entityRef) {
      setState({ loading: false, items: [] });
      return undefined;
    }
    let cancelled = false;
    setState({ loading: true, items: [] });
    (async () => {
      const entity = await catalogApi.getEntityByRef(entityRef);
      const project = entity?.metadata.annotations?.[MITEK_KARGO_PROJECT_ANNOTATION];
      if (!entity || !project) {
        throw new Error(`${entityRef} has no kargo/project annotation`);
      }
      const base = await discoveryApi.getBaseUrl('mitek-kargo');
      const res = await fetchApi.fetch(
        `${base}/projects/${encodeURIComponent(project)}/warehouses/${encodeURIComponent(entity.metadata.name)}/freight`,
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error ?? `Kargo request failed (${res.status})`);
      }
      return (body as MitekFreightList).items;
    })().then(
      items => !cancelled && setState({ loading: false, items }),
      (e: Error) =>
        !cancelled && setState({ loading: false, items: [], error: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [entityRef, catalogApi, discoveryApi, fetchApi]);

  // Drop a selection that doesn't belong to the selected component.
  useEffect(() => {
    if (
      formData &&
      !state.loading &&
      !state.items.some(f => f.name === formData)
    ) {
      onChange(undefined);
    }
  }, [formData, state, onChange]);

  let helperText = schema.description;
  if (state.error) helperText = state.error;
  else if (!entityRef) helperText = 'Select a component first';
  else if (state.loading) helperText = 'Loading Freight…';
  else if (state.items.length === 0) helperText = 'No Freight for this component yet';

  return (
    <TextField
      select
      fullWidth
      margin="normal"
      label={schema.title}
      required={required}
      value={formData ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={!entityRef || state.loading || state.items.length === 0}
      error={!!state.error || !!rawErrors?.length}
      helperText={helperText}
    >
      {state.items.map(f => (
        <MenuItem key={f.name} value={f.name}>
          {label(f)}
        </MenuItem>
      ))}
    </TextField>
  );
};

export const mitekFreightPickerField = createFormField({
  name: 'MitekFreightPicker',
  component: MitekFreightPicker,
});
