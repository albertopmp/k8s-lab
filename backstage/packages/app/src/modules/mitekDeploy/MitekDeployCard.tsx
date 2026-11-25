import { ButtonLink, Card, CardBody } from '@backstage/ui';
import { RiRocketLine } from '@remixicon/react';

/** Mitek: full-width "Deploy" button that opens the catalog import page. */
export const MitekDeployCard = () => (
  <Card>
    <CardBody>
      <ButtonLink
        href="/catalog-import"
        variant="primary"
        iconStart={<RiRocketLine />}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        Deploy
      </ButtonLink>
    </CardBody>
  </Card>
);
