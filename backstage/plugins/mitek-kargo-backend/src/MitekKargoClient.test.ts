import { MitekKargoClient } from './MitekKargoClient';
import { MitekKargoError } from './MitekKargoError';

// Shapes returned by the Kargo v1.12 REST API (/v1beta1).
const freight = (
  name: string,
  createdAt: string,
  warehouse: string,
  extra: Record<string, unknown> = {},
) => ({
  metadata: { name, creationTimestamp: createdAt },
  origin: { kind: 'Warehouse', name: warehouse },
  ...extra,
});

const freightResponse = (items: unknown[]) => ({ groups: { '': { items } } });

const allFreight = freightResponse([
  freight('aaa111', '2026-11-25T10:00:00Z', 'guestbook', {
    metadata: {
      name: 'aaa111',
      creationTimestamp: '2026-11-25T10:00:00Z',
      labels: { 'kargo.akuity.io/alias': 'old-otter' },
    },
    commits: [{ id: 'c0ffee1', message: 'first', branch: 'master' }],
    status: { verifiedIn: { dev: {}, stg: {} }, currentlyIn: { stg: {} } },
  }),
  freight('bbb222', '2026-11-25T12:00:00Z', 'guestbook', {
    alias: 'new-narwhal',
    commits: [{ id: 'c0ffee2', message: 'second' }],
  }),
  freight('ccc333', '2026-11-25T11:00:00Z', 'podinfo'),
]);

const stagesResponse = {
  items: [
    {
      metadata: { name: 'prd' },
      spec: {
        requestedFreight: [
          { origin: { kind: 'Warehouse', name: 'guestbook' }, sources: { stages: ['stg'] } },
        ],
      },
    },
    {
      metadata: { name: 'dev' },
      spec: {
        requestedFreight: [
          { origin: { kind: 'Warehouse', name: 'guestbook' }, sources: { direct: true } },
        ],
      },
    },
    {
      metadata: { name: 'stg' },
      spec: {
        requestedFreight: [
          { origin: { kind: 'Warehouse', name: 'guestbook' }, sources: { stages: ['dev'] } },
        ],
      },
    },
  ],
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('MitekKargoClient', () => {
  const fetchMock = jest.fn();
  const client = new MitekKargoClient('http://kargo/', 't0ken', 'http://localhost:8081');

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('lists one Warehouse’s Freight, newest first, with the token', async () => {
    fetchMock.mockResolvedValue(ok(allFreight));

    const items = await client.listFreight('k8s-lab', { warehouse: 'guestbook' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://kargo/v1beta1/projects/k8s-lab/freight',
      { headers: { Authorization: 'Bearer t0ken' } },
    );
    expect(items.map(f => f.name)).toEqual(['bbb222', 'aaa111']);
    expect(items[1]).toMatchObject({
      alias: 'old-otter',
      warehouse: 'guestbook',
      commits: [{ id: 'c0ffee1', message: 'first', branch: 'master' }],
      verifiedIn: ['dev', 'stg'],
      currentlyIn: ['stg'],
    });
  });

  it('caps the list with limit', async () => {
    fetchMock.mockResolvedValue(ok(allFreight));
    const items = await client.listFreight('k8s-lab', { limit: 2 });
    expect(items.map(f => f.name)).toEqual(['bbb222', 'ccc333']);
  });

  it('asks Kargo per Stage and returns promotable Stages in order', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/stages')) return ok(stagesResponse);
      if (url.endsWith('?stage=dev')) return ok(allFreight);
      if (url.endsWith('?stage=stg')) return ok(allFreight);
      if (url.endsWith('?stage=prd')) return ok(freightResponse([])); // not verified in stg
      return ok(allFreight);
    });

    await expect(client.getPromotableStages('k8s-lab', 'aaa111')).resolves.toEqual([
      'dev',
      'stg',
    ]);
  });

  it('fails clearly for unknown Freight', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      ok(url.endsWith('/stages') ? stagesResponse : allFreight),
    );
    await expect(client.getPromotableStages('k8s-lab', 'nope')).rejects.toThrow(
      'Freight nope does not exist in Kargo project k8s-lab',
    );
  });

  it('promotes and waits until the Promotion finishes', async () => {
    const promotion = (phase?: string) => ({
      metadata: { name: 'stg.123' },
      spec: { stage: 'stg', freight: 'aaa111' },
      status: phase ? { phase } : undefined,
    });
    fetchMock
      .mockResolvedValueOnce(ok(promotion())) // POST
      .mockResolvedValueOnce(ok(promotion('Running')))
      .mockResolvedValueOnce(ok(promotion('Succeeded')));
    const phases: (string | undefined)[] = [];

    const started = await client.promote('k8s-lab', 'stg', 'aaa111');
    const done = await client.waitForPromotion('k8s-lab', started.name, {
      intervalMs: 1,
      onChange: p => phases.push(p.phase),
    });

    expect(fetchMock.mock.calls[0]).toEqual([
      'http://kargo/v1beta1/projects/k8s-lab/stages/stg/promotions',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer t0ken', 'Content-Type': 'application/json' },
        body: JSON.stringify({ freight: 'aaa111' }),
      },
    ]);
    expect(done.phase).toBe('Succeeded');
    expect(phases).toEqual(['Running', 'Succeeded']);
    expect(client.promotionUrl('k8s-lab', 'stg.123')).toBe(
      'http://localhost:8081/project/k8s-lab/promotion/stg.123',
    );
  });

  it('times out with a link to the Promotion', async () => {
    fetchMock.mockResolvedValue(
      ok({ metadata: { name: 'p1' }, spec: { stage: 'stg', freight: 'f' }, status: { phase: 'Running' } }),
    );
    await expect(
      client.waitForPromotion('k8s-lab', 'p1', { timeoutMs: 0 }),
    ).rejects.toThrow(
      'Promotion p1 is still Running after 0 min; it keeps running in Kargo: http://localhost:8081/project/k8s-lab/promotion/p1',
    );
  });

  it('turns API errors into readable MitekKargoErrors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    });
    const error = await client.listFreight('k8s-lab').catch(e => e);
    expect(error).toBeInstanceOf(MitekKargoError);
    expect(error.status).toBe(403);
    expect(error.message).toBe(
      "Could not list Freight in k8s-lab: Backstage's Kargo API token isn't allowed to do this",
    );
  });
});
