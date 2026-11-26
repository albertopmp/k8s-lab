import { useEffect, useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  type FieldExtensionComponentProps,
  useTemplateSecrets,
} from '@backstage/plugin-scaffolder-react';
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormLabel from '@material-ui/core/FormLabel';
import TextField from '@material-ui/core/TextField';
import { formValue } from './KargoSelect';

type Options = { entityField?: string; stageField?: string };
type Secret = { name: string; awsName?: string };

/** Name of the secret in AWS Secrets Manager, `{env}` being the Stage. */
const AWS_SECRET_NAME_ANNOTATION = 'k8s-lab/aws-secret-name';

/**
 * Mitek: one password input per secret (Resource of type `secret`) the
 * component in another field depends on (`ui:options.entityField` /
 * `stageField`, defaults `component` / `stage`).
 *
 * Values go to the task's secrets as `secrets.<resource name>`, never into
 * the form data, so they are not shown or stored with the task; the form data
 * only holds masked values. It stays empty until every input is filled in, so
 * mark the field `required` to require all of them.
 */
function MitekSecretsInput(field: FieldExtensionComponentProps<Record<string, string>, Options>) {
  const catalogApi = useApi(catalogApiRef);
  const { secrets, setSecrets } = useTemplateSecrets();
  const options = field.uiSchema['ui:options'];
  const entityRef = formValue(field, options?.entityField ?? 'component');
  const stage = formValue(field, options?.stageField ?? 'stage');
  const [list, setList] = useState<Secret[]>(); // undefined while loading
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
      .then(result => current && setList(result))
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [entityRef, catalogApi]);

  // Form data: masked values once every secret is filled in, else empty.
  const { formData, onChange } = field;
  const complete = !!list && list.every(s => secrets[s.name]);
  useEffect(() => {
    if (complete !== !!formData) {
      onChange(complete ? Object.fromEntries(list!.map(s => [s.name, '********'])) : undefined);
    }
  }, [complete, formData, list, onChange]);

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
      {list?.map(s => (
        <TextField
          key={s.name}
          type="password"
          autoComplete="off"
          fullWidth
          margin="dense"
          required={field.required}
          label={s.name}
          value={secrets[s.name] ?? ''}
          onChange={e => setSecrets({ [s.name]: e.target.value })}
          helperText={stage ? s.awsName?.replace('{env}', stage) : s.awsName}
        />
      ))}
      <FormHelperText>{helperText}</FormHelperText>
    </FormControl>
  );
}

export const mitekSecretsInputField = createFormField({
  name: 'MitekSecretsInput',
  component: MitekSecretsInput,
});
