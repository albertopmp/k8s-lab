import { stringifyEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import { ButtonLink, Card, CardBody } from '@backstage/ui';
import { RiRocketLine } from '@remixicon/react';

/** Template the button opens (templates/mitek/kargo-promote). */
const PROMOTE_TEMPLATE = '/create/templates/default/mitek-kargo-promote';

/**
 * Mitek: full-width "Deploy" button that opens the Kargo promotion template
 * with this component already selected (the scaffolder reads `?formData=`).
 */
export function MitekDeployCard() {
  const { entity } = useEntity();
  const formData = JSON.stringify({ component: stringifyEntityRef(entity) });

  return (
    <Card>
      <CardBody>
        <ButtonLink
          href={`${PROMOTE_TEMPLATE}?formData=${encodeURIComponent(formData)}`}
          variant="primary"
          iconStart={<RiRocketLine />}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Deploy via Kargo
        </ButtonLink>
      </CardBody>
    </Card>
  );
}
