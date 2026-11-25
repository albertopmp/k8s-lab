import type { CatalogService } from '@backstage/plugin-catalog-node';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { MITEK_KARGO_PROJECT_ANNOTATION } from '@internal/backstage-plugin-mitek-kargo-common';
import type { MitekKargoClient } from './MitekKargoClient';

/**
 * Mitek: `mitek:kargo:promote` promotes a component's Freight to a Stage and
 * waits until the Promotion has finished. Any problem fails the step with a
 * message meant for the user.
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
        timeoutMinutes: z => z.number({ description: 'How long to wait (default 10)' }).optional(),
      },
      output: {
        project: z => z.string(),
        phase: z => z.string(),
        freightAlias: z => z.string().optional(),
        promotionUrl: z => z.string().optional(),
      },
    },

    async handler(ctx) {
      const { entityRef, freight, stage } = ctx.input;
      if (!client) {
        throw new Error('Kargo is not configured in Backstage (mitek.kargo.baseUrl / mitek.kargo.token)');
      }

      // The component tells us the Kargo Project; its name is the Warehouse.
      const entity = await catalog.getEntityByRef(entityRef, {
        credentials: await ctx.getInitiatorCredentials(),
      });
      const project = entity?.metadata.annotations?.[MITEK_KARGO_PROJECT_ANNOTATION];
      if (!entity || !project) {
        throw new Error(`${entityRef} is not in the catalog or has no ${MITEK_KARGO_PROJECT_ANNOTATION} annotation`);
      }
      ctx.output('project', project);

      // The Freight must be this component's.
      const freightList = await client.listFreight(project, { warehouse: entity.metadata.name });
      const target = freightList.find(f => f.name === freight);
      if (!target) {
        throw new Error(`Freight ${freight} does not belong to ${entity.metadata.name}`);
      }
      const name = target.alias ?? freight.slice(0, 7);
      if (target.alias) ctx.output('freightAlias', target.alias);

      if (target.currentlyIn.includes(stage)) {
        ctx.logger.info(`${name} is already running in ${stage}; nothing to do.`);
        ctx.output('phase', 'Succeeded');
        return;
      }

      // Kargo must accept it in that Stage (e.g. prd needs it verified in stg).
      const promotable = await client.getPromotableStages(project, freight);
      if (!promotable.includes(stage)) {
        throw new Error(
          `${name} can't be promoted to ${stage} yet. ` +
            (promotable.length
              ? `It can go to ${promotable.join(', ')}: promote it there first.`
              : 'No Stage accepts it right now.'),
        );
      }

      // Promote and wait.
      ctx.logger.info(`Promoting ${name} to ${stage} in Kargo project ${project}…`);
      const promotion = await client.promote(project, stage, freight);
      const url = client.promotionUrl(project, promotion.name);
      ctx.output('promotionUrl', url);
      ctx.logger.info(`Promotion started: ${url}`);

      const result = await client.waitForPromotion(project, promotion.name, {
        timeoutMs: (ctx.input.timeoutMinutes ?? 10) * 60_000,
        signal: ctx.signal,
        onChange: p => ctx.logger.info(`Promotion ${p.phase ?? 'Pending'}${p.message ? `: ${p.message}` : ''}`),
      });
      ctx.output('phase', result.phase ?? 'Unknown');

      if (result.phase !== 'Succeeded') {
        throw new Error(
          `Promotion to ${stage} ${result.phase?.toLowerCase()}` +
            `${result.message ? `: ${result.message}` : ''}. Details: ${url}`,
        );
      }
      ctx.logger.info(`${name} is now in ${stage}.`);
    },
  });
}
