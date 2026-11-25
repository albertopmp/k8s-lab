import type { Config } from '@backstage/config';
import type {
  MitekFreight,
  MitekPromotion,
} from '@internal/backstage-plugin-mitek-kargo-common';
import { MitekKargoError, toKargoError } from './MitekKargoError';

/** Raw Kargo resources: only the fields we read. */
type KargoFreight = {
  metadata: { name: string; creationTimestamp?: string; labels?: Record<string, string> };
  alias?: string;
  origin?: { kind: string; name: string };
  commits?: { id: string; message?: string; branch?: string; repoURL?: string }[];
  status?: { verifiedIn?: object; currentlyIn?: object };
};

type KargoStage = {
  metadata: { name: string };
  spec: {
    requestedFreight?: {
      origin: { kind: string; name: string };
      sources?: { direct?: boolean; stages?: string[] };
    }[];
  };
};

type KargoPromotion = {
  metadata: { name: string; creationTimestamp?: string };
  spec: { stage: string; freight: string };
  status?: { phase?: MitekPromotion['phase']; message?: string };
};

const FINISHED = ['Succeeded', 'Failed', 'Errored', 'Aborted'];

/**
 * Mitek: client for the Kargo REST API (/v1beta1), authenticated with a Kargo
 * API token. Every failure is a MitekKargoError with a user-readable message.
 */
export class MitekKargoClient {
  /** Reads `mitek.kargo.{baseUrl,token,uiUrl}`; undefined if not configured. */
  static fromConfig(config: Config): MitekKargoClient | undefined {
    const baseUrl = config.getOptionalString('mitek.kargo.baseUrl');
    const token = config.getOptionalString('mitek.kargo.token');
    if (!baseUrl || !token) return undefined;
    const uiUrl = config.getOptionalString('mitek.kargo.uiUrl') ?? baseUrl;
    return new MitekKargoClient(baseUrl, token, uiUrl);
  }

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly uiUrl: string = baseUrl,
  ) {}

  /**
   * Freight of a project, newest first.
   * - warehouse: only Freight from that Warehouse
   * - stage: only Freight Kargo says that Stage can accept
   * - limit: at most this many
   */
  async listFreight(
    project: string,
    filter: { warehouse?: string; stage?: string; limit?: number } = {},
  ): Promise<MitekFreight[]> {
    const query = filter.stage ? `?stage=${encodeURIComponent(filter.stage)}` : '';
    const body = await this.request<{ groups?: Record<string, { items?: KargoFreight[] }> }>(
      `/projects/${encodeURIComponent(project)}/freight${query}`,
      `list Freight in ${project}`,
    );

    let freight = Object.values(body.groups ?? {})
      .flatMap(group => group.items ?? [])
      .map(toFreight)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    if (filter.warehouse) {
      freight = freight.filter(f => f.warehouse === filter.warehouse);
    }
    return filter.limit ? freight.slice(0, filter.limit) : freight;
  }

  /**
   * Stages a Freight can be promoted to, in promotion order (dev, stg, prd).
   * Kargo decides: for each Stage fed by the Freight's Warehouse, we ask which
   * Freight that Stage accepts.
   */
  async getPromotableStages(project: string, freightName: string): Promise<string[]> {
    const [allFreight, stages] = await Promise.all([
      this.listFreight(project),
      this.listStages(project),
    ]);
    const freight = allFreight.find(f => f.name === freightName);
    if (!freight) {
      throw new MitekKargoError(`Freight ${freightName} does not exist in Kargo project ${project}`, 404);
    }

    const promotable: string[] = [];
    for (const stage of inPromotionOrder(stages)) {
      const fedByWarehouse = (stage.spec.requestedFreight ?? []).some(
        r => r.origin.kind === 'Warehouse' && r.origin.name === freight.warehouse,
      );
      if (!fedByWarehouse) continue;
      const accepted = await this.listFreight(project, { stage: stage.metadata.name });
      if (accepted.some(f => f.name === freightName)) {
        promotable.push(stage.metadata.name);
      }
    }
    return promotable;
  }

  /** Starts promoting a Freight to a Stage. */
  async promote(project: string, stage: string, freight: string): Promise<MitekPromotion> {
    const body = await this.request<KargoPromotion>(
      `/projects/${encodeURIComponent(project)}/stages/${encodeURIComponent(stage)}/promotions`,
      `promote Freight ${freight} to ${stage}`,
      { method: 'POST', body: JSON.stringify({ freight }) },
    );
    return toPromotion(body);
  }

  async getPromotion(project: string, name: string): Promise<MitekPromotion> {
    const body = await this.request<KargoPromotion | { promotion: KargoPromotion }>(
      `/projects/${encodeURIComponent(project)}/promotions/${encodeURIComponent(name)}`,
      `read Promotion ${name}`,
    );
    return toPromotion('promotion' in body ? body.promotion : body);
  }

  /**
   * Checks a Promotion every `intervalMs` (default 2s) until it has finished,
   * then returns it (whatever the outcome). Calls `onChange` whenever its
   * phase changes. Throws on timeout (default 10 min) or when `signal` aborts.
   */
  async waitForPromotion(
    project: string,
    name: string,
    options: {
      timeoutMs?: number;
      intervalMs?: number;
      signal?: AbortSignal;
      onChange?: (promotion: MitekPromotion) => void;
    } = {},
  ): Promise<MitekPromotion> {
    const timeoutMs = options.timeoutMs ?? 10 * 60_000;
    const deadline = Date.now() + timeoutMs;
    let lastPhase: string | undefined = '';

    for (;;) {
      const promotion = await this.getPromotion(project, name);
      if (promotion.phase !== lastPhase) {
        lastPhase = promotion.phase;
        options.onChange?.(promotion);
      }
      if (promotion.phase && FINISHED.includes(promotion.phase)) {
        return promotion;
      }
      if (Date.now() >= deadline) {
        throw new MitekKargoError(
          `Promotion ${name} is still ${promotion.phase ?? 'Pending'} after ` +
            `${Math.round(timeoutMs / 60_000)} min; it keeps running in Kargo: ` +
            this.promotionUrl(project, name),
        );
      }
      if (options.signal?.aborted) {
        throw new MitekKargoError('Stopped waiting: the task was cancelled');
      }
      await new Promise(resolve => setTimeout(resolve, options.intervalMs ?? 2_000));
    }
  }

  /** Link to a Promotion in the Kargo UI. */
  promotionUrl(project: string, name: string): string {
    return `${trimSlash(this.uiUrl)}/project/${encodeURIComponent(project)}/promotion/${encodeURIComponent(name)}`;
  }

  private async listStages(project: string): Promise<KargoStage[]> {
    const body = await this.request<{ items?: KargoStage[] }>(
      `/projects/${encodeURIComponent(project)}/stages`,
      `list Stages in ${project}`,
    );
    return body.items ?? [];
  }

  /** Calls the Kargo API; `action` describes the call for error messages. */
  private async request<T>(path: string, action: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${trimSlash(this.baseUrl)}/v1beta1${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch (e) {
      throw new MitekKargoError(`Could not ${action}: Kargo is unreachable (${(e as Error).message})`);
    }
    if (!res.ok) throw await toKargoError(res, action);
    return (await res.json()) as T;
  }
}

function toFreight(f: KargoFreight): MitekFreight {
  return {
    name: f.metadata.name,
    alias: f.alias ?? f.metadata.labels?.['kargo.akuity.io/alias'],
    warehouse: f.origin?.kind === 'Warehouse' ? f.origin.name : '',
    createdAt: f.metadata.creationTimestamp,
    commits: (f.commits ?? []).map(({ id, message, branch, repoURL }) => ({
      id,
      message,
      branch,
      repoURL,
    })),
    verifiedIn: Object.keys(f.status?.verifiedIn ?? {}),
    currentlyIn: Object.keys(f.status?.currentlyIn ?? {}),
  };
}

function toPromotion(p: KargoPromotion): MitekPromotion {
  return {
    name: p.metadata.name,
    stage: p.spec.stage,
    freight: p.spec.freight,
    phase: p.status?.phase,
    message: p.status?.message,
    createdAt: p.metadata.creationTimestamp,
  };
}

/**
 * Sorts Stages so each comes after the Stages it takes Freight from:
 * dev (fed by Warehouses), then stg (fed by dev), then prd (fed by stg).
 */
function inPromotionOrder(stages: KargoStage[]): KargoStage[] {
  const upstreamOf = (stage: KargoStage) =>
    (stage.spec.requestedFreight ?? []).flatMap(r => r.sources?.stages ?? []);

  const ordered: KargoStage[] = [];
  let remaining = [...stages].sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  while (remaining.length) {
    const placed = new Set(ordered.map(s => s.metadata.name));
    const ready = remaining.filter(s => upstreamOf(s).every(up => placed.has(up)));
    // A cycle (shouldn't happen) would leave nothing ready; keep the rest as-is.
    const next = ready.length ? ready : remaining;
    ordered.push(...next);
    remaining = remaining.filter(s => !next.includes(s));
  }
  return ordered;
}

const trimSlash = (url: string) => url.replace(/\/$/, '');
