import type { Config } from '@backstage/config';
import type { MitekFreight } from '@internal/backstage-plugin-mitek-kargo-common';
import { MitekKargoError, toKargoError } from './MitekKargoError';

/** A Kargo Promotion: only the fields we use. */
export type MitekPromotion = {
  name: string;
  /** Pending, Running, Succeeded, Failed, Errored or Aborted; empty at first. */
  phase?: string;
  message?: string;
};

/** Raw Kargo resources: only the fields we read. */
type KargoFreight = {
  metadata: { name: string; creationTimestamp?: string };
  alias?: string;
  commits?: { id: string; message?: string }[];
};

type KargoStage = {
  metadata: { name: string };
  spec: { requestedFreight?: { sources?: { stages?: string[] } }[] };
};

type KargoPromotion = {
  metadata: { name: string };
  status?: { phase?: string; message?: string };
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
    const params = new URLSearchParams();
    if (filter.warehouse) params.set('origins', filter.warehouse);
    if (filter.stage) params.set('stage', filter.stage);
    const query = params.toString();
    const body = await this.request<{ groups?: Record<string, { items?: KargoFreight[] }> }>(
      `/projects/${encodeURIComponent(project)}/freight${query ? `?${query}` : ''}`,
      `list Freight in ${project}`,
    );

    const freight = Object.values(body.groups ?? {})
      .flatMap(group => group.items ?? [])
      .sort((a, b) =>
        (b.metadata.creationTimestamp ?? '').localeCompare(a.metadata.creationTimestamp ?? ''),
      )
      .map(f => ({
        name: f.metadata.name,
        alias: f.alias,
        commits: (f.commits ?? []).map(({ id, message }) => ({ id, message })),
      }));
    return filter.limit ? freight.slice(0, filter.limit) : freight;
  }

  /**
   * Stages a Freight can be promoted to, in promotion order (dev, stg, prd).
   * Kargo decides: for each Stage, we ask which Freight it accepts.
   */
  async getPromotableStages(project: string, freight: string): Promise<string[]> {
    const promotable: string[] = [];
    for (const stage of await this.listStagesInOrder(project)) {
      const accepted = await this.listFreight(project, { stage });
      if (accepted.some(f => f.name === freight)) promotable.push(stage);
    }
    return promotable;
  }

  /** Starts promoting a Freight to a Stage; Kargo rejects invalid ones. */
  async promote(project: string, stage: string, freight: string): Promise<MitekPromotion> {
    const body = await this.request<KargoPromotion>(
      `/projects/${encodeURIComponent(project)}/stages/${encodeURIComponent(stage)}/promotions`,
      `promote Freight ${freight} to ${stage}`,
      { method: 'POST', body: JSON.stringify({ freight }) },
    );
    return toPromotion(body);
  }

  async getPromotion(project: string, name: string): Promise<MitekPromotion> {
    const body = await this.request<KargoPromotion>(
      `/projects/${encodeURIComponent(project)}/promotions/${encodeURIComponent(name)}`,
      `read Promotion ${name}`,
    );
    return toPromotion(body);
  }

  /**
   * Checks a Promotion every `intervalMs` (default 10s) until it has finished,
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
      await new Promise(resolve => setTimeout(resolve, options.intervalMs ?? 10_000));
    }
  }

  /** Link to a Promotion in the Kargo UI. */
  promotionUrl(project: string, name: string): string {
    return `${trimSlash(this.uiUrl)}/project/${encodeURIComponent(project)}/promotion/${encodeURIComponent(name)}`;
  }

  /**
   * Stage names sorted so each comes after the Stages it takes Freight from:
   * dev (fed by Warehouses), then stg (fed by dev), then prd (fed by stg).
   */
  private async listStagesInOrder(project: string): Promise<string[]> {
    const body = await this.request<{ items?: KargoStage[] }>(
      `/projects/${encodeURIComponent(project)}/stages`,
      `list Stages in ${project}`,
    );
    const upstream = new Map(
      (body.items ?? []).map(s => [
        s.metadata.name,
        (s.spec.requestedFreight ?? []).flatMap(r => r.sources?.stages ?? []),
      ]),
    );

    const ordered: string[] = [];
    let remaining = [...upstream.keys()].sort();
    while (remaining.length) {
      const ready = remaining.filter(s => upstream.get(s)!.every(up => ordered.includes(up)));
      // A cycle (shouldn't happen) would leave nothing ready; keep the rest as-is.
      const next = ready.length ? ready : remaining;
      ordered.push(...next);
      remaining = remaining.filter(s => !next.includes(s));
    }
    return ordered;
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

function toPromotion(p: KargoPromotion): MitekPromotion {
  return { name: p.metadata.name, phase: p.status?.phase, message: p.status?.message };
}

const trimSlash = (url: string) => url.replace(/\/$/, '');
