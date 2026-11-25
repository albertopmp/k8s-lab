import type { MitekFreight } from '@internal/backstage-plugin-mitek-kargo-common';

/**
 * Mitek: minimal client for the Kargo REST API (/v1beta1).
 * Authenticates with a Kargo API token (a project ServiceAccount token).
 */

type KargoFreight = {
  metadata: {
    name: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
  };
  alias?: string;
  origin?: { kind: string; name: string };
  commits?: { id: string; message?: string; branch?: string; repoURL?: string }[];
  status?: { verifiedIn?: Record<string, unknown> };
};

export class MitekKargoClient {
  constructor(
    private readonly options: { baseUrl: string; token: string },
  ) {}

  /** Freight of a project, optionally only from one Warehouse; newest first. */
  async listFreight(project: string, warehouse?: string): Promise<MitekFreight[]> {
    const res = await fetch(
      `${this.options.baseUrl}/v1beta1/projects/${encodeURIComponent(project)}/freight`,
      { headers: { Authorization: `Bearer ${this.options.token}` } },
    );
    if (!res.ok) {
      throw new Error(`Kargo API returned ${res.status} for project ${project}`);
    }
    // Response: { groups: { "<group>": { items: Freight[] } } }
    const body = (await res.json()) as {
      groups?: Record<string, { items?: KargoFreight[] }>;
    };
    const items = Object.values(body.groups ?? {}).flatMap(g => g.items ?? []);

    return items
      .filter(
        f =>
          !warehouse ||
          (f.origin?.kind === 'Warehouse' && f.origin.name === warehouse),
      )
      .map(f => ({
        name: f.metadata.name,
        alias: f.alias ?? f.metadata.labels?.['kargo.akuity.io/alias'],
        warehouse: f.origin?.name ?? '',
        createdAt: f.metadata.creationTimestamp,
        commits: (f.commits ?? []).map(c => ({
          id: c.id,
          message: c.message,
          branch: c.branch,
          repoURL: c.repoURL,
        })),
        verifiedIn: Object.keys(f.status?.verifiedIn ?? {}),
      }))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }
}
