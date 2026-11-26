import { useEffect, useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  type FieldExtensionComponentProps,
  useTemplateSecrets,
} from '@backstage/plugin-scaffolder-react';
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormLabel from '@material-ui/core/FormLabel';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { RiAddLine, RiDeleteBinLine, RiEyeLine, RiEyeOffLine } from '@remixicon/react';
import { formValue } from './KargoSelect';

type Options = { entityField?: string; stageField?: string };
type Secret = { name: string; awsName?: string };
type Row = { key: string; value: string; visible?: boolean };

/** Name of the secret in AWS Secrets Manager, `{env}` being the Stage. */
const AWS_SECRET_NAME_ANNOTATION = 'k8s-lab/aws-secret-name';

const emptyRow = (): Row => ({ key: '', value: '' });
const filled = (r: Row) => !!r.key && !!r.value;

/**
 * Mitek: key/value pairs for each secret (Resource of type `secret`) the
 * component in another field depends on (`ui:options.entityField` /
 * `stageField`, defaults `component` / `stage`).
 *
 * Each secret's pairs go to the task's secrets as a JSON object string,
 * `secrets.<resource name>` = `{"KEY":"value",...}`, never into the form data,
 * so they are not shown or stored with the task; the form data only lists the
 * key names. It stays empty until every secret has at least one complete pair
 * and no half-filled ones, so mark the field `required` to require that.
 */
function MitekSecretsInput(field: FieldExtensionComponentProps<Record<string, string[]>, Options>) {
  const catalogApi = useApi(catalogApiRef);
  const { setSecrets } = useTemplateSecrets();
  const options = field.uiSchema['ui:options'];
  const entityRef = formValue(field, options?.entityField ?? 'component');
  const stage = formValue(field, options?.stageField ?? 'stage');
  const [list, setList] = useState<Secret[]>(); // undefined while loading
  const [rows, setRows] = useState<Record<string, Row[]>>({});
  const [error, setError] = useState<string>();

  useEffect(() => {
    setList(undefined);
    setError(undefined);
    if (!entityRef) return undefined;

    let current = true;
    (async () => {
      const entity = await catalogApi.getEntityByRef(entityRef);
      const entityRefs = (entity?.relations ?? [])
        .filter(r => r.type === 'dependsOn' && r.targetRef.startsWith('resource:'))
        .map(r => r.targetRef);
      const { items } = await catalogApi.getEntitiesByRefs({ entityRefs });
      return items
        .filter(e => e?.spec?.type === 'secret')
        .map(e => ({
          name: e!.metadata.name,
          awsName: e!.metadata.annotations?.[AWS_SECRET_NAME_ANNOTATION],
        }));
    })()
      .then(result => {
        if (!current) return;
        setList(result);
        setRows(Object.fromEntries(result.map(s => [s.name, [emptyRow()]])));
      })
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [entityRef, catalogApi]);

  /** Replaces a secret's rows and its value in the task's secrets. */
  const update = (name: string, next: Row[]) => {
    setRows(prev => ({ ...prev, [name]: next }));
    const pairs = Object.fromEntries(next.filter(filled).map(r => [r.key, r.value]));
    setSecrets({ [name]: JSON.stringify(pairs) });
  };

  // Form data: each secret's key names once all of them are complete, else empty.
  const { formData, onChange } = field;
  const complete =
    !!list &&
    list.every(s => {
      const r = rows[s.name] ?? [];
      return r.some(filled) && r.every(x => filled(x) || (!x.key && !x.value));
    });
  const keys = complete
    ? Object.fromEntries(list!.map(s => [s.name, rows[s.name].filter(filled).map(r => r.key)]))
    : undefined;
  useEffect(() => {
    if (JSON.stringify(keys) !== JSON.stringify(formData)) onChange(keys);
  }, [keys, formData, onChange]);

  let helperText = field.schema.description;
  if (error) helperText = error;
  else if (!entityRef) helperText = 'Select a component first';
  else if (!list) helperText = "Loading the component's secrets…";
  else if (list.length === 0) helperText = 'This component depends on no secrets';

  return (
    <FormControl
      fullWidth
      margin="normal"
      required={field.required}
      error={!!error || !!field.rawErrors?.length}
    >
      <FormLabel>{field.schema.title}</FormLabel>
      {list?.map(s => {
        const secretRows = rows[s.name] ?? [];
        const set = (i: number, change: Partial<Row>) =>
          update(s.name, secretRows.map((r, j) => (j === i ? { ...r, ...change } : r)));
        return (
          <Box key={s.name} mt={2}>
            <Typography variant="subtitle2">{s.name}</Typography>
            {s.awsName && (
              <Typography variant="caption" color="textSecondary">
                {stage ? s.awsName.replace('{env}', stage) : s.awsName}
              </Typography>
            )}
            {secretRows.map((r, i) => (
              <Box key={i} display="flex" alignItems="center" style={{ gap: 8 }}>
                <TextField
                  label="Key"
                  margin="dense"
                  autoComplete="off"
                  style={{ flex: 1 }}
                  value={r.key}
                  onChange={e => set(i, { key: e.target.value })}
                />
                <TextField
                  label="Value"
                  margin="dense"
                  autoComplete="off"
                  type={r.visible ? 'text' : 'password'}
                  style={{ flex: 2 }}
                  value={r.value}
                  onChange={e => set(i, { value: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label={r.visible ? 'Hide value' : 'Show value'}
                          onClick={() => set(i, { visible: !r.visible })}
                        >
                          {r.visible ? <RiEyeOffLine size={18} /> : <RiEyeLine size={18} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <IconButton
                  size="small"
                  aria-label="Remove key"
                  disabled={secretRows.length === 1}
                  onClick={() => update(s.name, secretRows.filter((_, j) => j !== i))}
                >
                  <RiDeleteBinLine size={18} />
                </IconButton>
              </Box>
            ))}
            <Button
              size="small"
              startIcon={<RiAddLine size={16} />}
              onClick={() => update(s.name, [...secretRows, emptyRow()])}
            >
              Add key
            </Button>
          </Box>
        );
      })}
      <FormHelperText>{helperText}</FormHelperText>
    </FormControl>
  );
}

export const mitekSecretsInputField = createFormField({
  name: 'MitekSecretsInput',
  component: MitekSecretsInput,
});
