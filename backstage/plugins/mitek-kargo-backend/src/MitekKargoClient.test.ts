import { MitekKargoClient } from './MitekKargoClient';

// Shape returned by GET /v1beta1/projects/{project}/freight (Kargo v1.12).
const response = {
  groups: {
    '': {
      items: [
        {
          metadata: {
            name: 'aaa111',
            creationTimestamp: '2026-11-25T10:00:00Z',
            labels: { 'kargo.akuity.io/alias': 'old-otter' },
          },
          origin: { kind: 'Warehouse', name: 'guestbook' },
          commits: [{ id: 'c0ffee1', message: 'first', branch: 'master' }],
          status: { verifiedIn: { dev: {}, stg: {} } },
        },
        {
          metadata: { name: 'bbb222', creationTimestamp: '2026-11-25T12:00:00Z' },
          alias: 'new-narwhal',
          origin: { kind: 'Warehouse', name: 'guestbook' },
          commits: [{ id: 'c0ffee2', message: 'second' }],
        },
        {
          metadata: { name: 'ccc333', creationTimestamp: '2026-11-25T11:00:00Z' },
          origin: { kind: 'Warehouse', name: 'podinfo' },
        },
      ],
    },
  },
};

describe('MitekKargoClient', () => {
  const fetchMock = jest.fn();
  const client = new MitekKargoClient({
    baseUrl: 'http://kargo',
    token: 't0ken',
  });

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('lists one Warehouse’s Freight, newest first, with the token', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response });

    const items = await client.listFreight('k8s-lab', 'guestbook');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://kargo/v1beta1/projects/k8s-lab/freight',
      { headers: { Authorization: 'Bearer t0ken' } },
    );
    expect(items.map(f => f.name)).toEqual(['bbb222', 'aaa111']);
    expect(items[0]).toMatchObject({ alias: 'new-narwhal', verifiedIn: [] });
    expect(items[1]).toMatchObject({
      alias: 'old-otter',
      warehouse: 'guestbook',
      commits: [{ id: 'c0ffee1', message: 'first', branch: 'master' }],
      verifiedIn: ['dev', 'stg'],
    });
  });

  it('lists all Freight when no Warehouse is given', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response });
    const items = await client.listFreight('k8s-lab');
    expect(items.map(f => f.name)).toEqual(['bbb222', 'ccc333', 'aaa111']);
  });

  it('throws on API errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    await expect(client.listFreight('k8s-lab')).rejects.toThrow(
      'Kargo API returned 403 for project k8s-lab',
    );
  });
});
