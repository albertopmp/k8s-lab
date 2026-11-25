import { useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';

type UiOptions = {
  /** Form field holding the selected entity ref. Defaults to `component`. */
  entityField?: string;
};

type TagsState = { loading: boolean; tags: string[]; error?: string };

/**
 * Mitek: dropdown of the Git tags of the GitHub repo behind the Component
 * selected in another field (read from its `github.com/project-slug`
 * annotation). Tags come through the `/github` proxy endpoint in app-config.
 */
export const MitekGitTagPicker = (
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
  const [state, setState] = useState<TagsState>({ loading: false, tags: [] });

  useEffect(() => {
    if (!entityRef) {
      setState({ loading: false, tags: [] });
      return undefined;
    }
    let cancelled = false;
    setState({ loading: true, tags: [] });
    (async () => {
      const entity = await catalogApi.getEntityByRef(entityRef);
      const slug = entity?.metadata.annotations?.['github.com/project-slug'];
      if (!slug) {
        throw new Error(`${entityRef} has no github.com/project-slug annotation`);
      }
      const proxy = await discoveryApi.getBaseUrl('proxy');
      const res = await fetchApi.fetch(
        `${proxy}/github/repos/${slug}/tags?per_page=100`,
      );
      if (!res.ok) {
        throw new Error(`GitHub returned ${res.status} for ${slug}`);
      }
      const tags: { name: string }[] = await res.json();
      return tags.map(t => t.name);
    })().then(
      tags => !cancelled && setState({ loading: false, tags }),
      (e: Error) =>
        !cancelled && setState({ loading: false, tags: [], error: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [entityRef, catalogApi, discoveryApi, fetchApi]);

  // Drop a selection that no longer belongs to the selected component's repo.
  useEffect(() => {
    if (formData && !state.loading && !state.tags.includes(formData)) {
      onChange(undefined);
    }
  }, [formData, state, onChange]);

  let helperText = schema.description;
  if (state.error) helperText = state.error;
  else if (!entityRef) helperText = 'Select a component first';
  else if (state.loading) helperText = 'Loading tags…';
  else if (state.tags.length === 0) helperText = 'This repository has no tags';

  return (
    <TextField
      select
      fullWidth
      margin="normal"
      label={schema.title}
      required={required}
      value={formData ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={!entityRef || state.loading || state.tags.length === 0}
      error={!!state.error || !!rawErrors?.length}
      helperText={helperText}
    >
      {state.tags.map(tag => (
        <MenuItem key={tag} value={tag}>
          {tag}
        </MenuItem>
      ))}
    </TextField>
  );
};

export const mitekGitTagPickerField = createFormField({
  name: 'MitekGitTagPicker',
  component: MitekGitTagPicker,
});
