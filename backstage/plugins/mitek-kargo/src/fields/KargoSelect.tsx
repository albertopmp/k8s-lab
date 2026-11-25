import { useEffect, useState } from 'react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';

export type Option = { value: string; label: string };

/**
 * Mitek: dropdown for scaffolder fields whose options come from Kargo.
 *
 * `dependsOn` is undefined until the fields it needs are filled in; every time
 * it changes, `load` runs again. Shows loading/empty/error states as helper
 * text and clears a value that is no longer among the options.
 */
export function KargoSelect(props: {
  field: FieldExtensionComponentProps<string, any>;
  dependsOn?: string;
  load: () => Promise<Option[]>;
  texts: { waiting: string; loading: string; empty: string };
}) {
  const { field, dependsOn, load, texts } = props;
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setOptions([]);
    setError(undefined);
    if (!dependsOn) return undefined;

    let current = true;
    setLoading(true);
    load()
      .then(result => current && setOptions(result))
      .catch((e: Error) => current && setError(e.message))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
    // `load` is a new function every render; `dependsOn` says when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependsOn]);

  // Clear a value the new options don't contain.
  const { formData, onChange } = field;
  useEffect(() => {
    if (formData && !loading && !options.some(o => o.value === formData)) {
      onChange(undefined);
    }
  }, [formData, loading, options, onChange]);

  let helperText = field.schema.description;
  if (error) helperText = error;
  else if (!dependsOn) helperText = texts.waiting;
  else if (loading) helperText = texts.loading;
  else if (options.length === 0) helperText = texts.empty;

  return (
    <TextField
      select
      fullWidth
      margin="normal"
      label={field.schema.title}
      required={field.required}
      value={formData ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={loading || options.length === 0}
      error={!!error || !!field.rawErrors?.length}
      helperText={helperText}
    >
      {options.map(o => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** Value of another field in the form (all steps). */
export function formValue(field: FieldExtensionComponentProps<string, any>, name: string) {
  return field.formContext?.formData?.[name] as string | undefined;
}
