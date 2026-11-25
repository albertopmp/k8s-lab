/**
 * Mitek: an error from the Kargo API (or from waiting on it), carrying a
 * message meant to be shown to users as-is.
 *
 * @public
 */
export class MitekKargoError extends Error {
  readonly name = 'MitekKargoError';

  constructor(
    message: string,
    /** HTTP status Kargo answered with, if the error came from a response. */
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Turns a failed Kargo response into a MitekKargoError with a clear message. */
export async function toKargoError(
  res: Response,
  action: string,
): Promise<MitekKargoError> {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error ?? body?.message ?? '';
  } catch {
    // not JSON; fall back to the status
  }
  const reason =
    {
      401: 'the Kargo API token was rejected (rerun `make secrets`)',
      403: "Backstage's Kargo API token isn't allowed to do this",
      404: 'it was not found in Kargo',
    }[res.status] ?? `Kargo answered ${res.status}`;
  return new MitekKargoError(
    `Could not ${action}: ${detail || reason}`,
    res.status,
  );
}
