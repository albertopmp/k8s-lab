import type { CatalogService } from '@backstage/plugin-catalog-node';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { MITEK_KARGO_PROJECT_ANNOTATION } from '@internal/backstage-plugin-mitek-kargo-common';
import type { MitekKargoClient } from './MitekKargoClient';

/**
 * Mitek: `mitek:kargo:promote` promotes a component's Freight to a Stage and
 * waits (up to 10 minutes) until the Promotion has finished.
 *
 * It doesn't re-check what the form already limits (the Freight belongs to the
 * component, the Stage accepts it): Kargo rejects invalid promotions itself,
 * and its message fails the step.
 */
export function createPromoteAction(client: MitekKargoClient | undefined, catalog: CatalogService) {
  return createTemplateAction({
    id: 'mitek:kargo:promote',
    description: "Promotes a component's Kargo Freight to a Stage and waits for the Promotion",
    schema: {
      input: {
        entityRef: z => z.string({ description: 'Component, e.g. component:default/guestbook' }),
        freight: z => z.string({ description: 'Freight name' }),
        stage: z => z.string({ description: 'Stage to promote to, e.g. stg' }),
      },
      output: {
        promotionUrl: z => z.string(),
      },
    },

    async handler(ctx) {
      const { entityRef, freight, stage } = ctx.input;
      if (!client) {
        throw new Error('Kargo is not configured in Backstage (mitek.kargo.baseUrl / mitek.kargo.token)');
      }

      // The component's annotation names its Kargo Project.
      const entity = await catalog.getEntityByRef(entityRef, {
        credentials: await ctx.getInitiatorCredentials(),
      });
      const project = entity?.metadata.annotations?.[MITEK_KARGO_PROJECT_ANNOTATION];
      if (!project) {
        throw new Error(`${entityRef} is not in the catalog or has no ${MITEK_KARGO_PROJECT_ANNOTATION} annotation`);
      }

      ctx.logger.info(`Promoting Freight ${freight} to ${stage} in Kargo project ${project}…`);
      const promotion = await client.promote(project, stage, freight);
      const url = client.promotionUrl(project, promotion.name);
      ctx.output('promotionUrl', url);
      ctx.logger.info(`Promotion started: ${url}`);

      const result = await client.waitForPromotion(project, promotion.name, {
        signal: ctx.signal,
        onChange: p => ctx.logger.info(`Promotion ${p.phase ?? 'Pending'}${p.message ? `: ${p.message}` : ''}`),
      });
      if (result.phase !== 'Succeeded') {
        throw new Error(
          `Promotion to ${stage} ${result.phase?.toLowerCase()}` +
            `${result.message ? `: ${result.message}` : ''}. Details: ${url}`,
        );
      }
      ctx.logger.info(`Freight is now in ${stage}.`);
    },
  });
}
