/** The server's error message for a failed request, with any validation details appended. */
export async function getApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string; details?: Array<{ path?: string; message?: string }> };
  } | null;
  const details = payload?.error?.details?.map((detail) => `${detail.path ?? "$"}: ${detail.message ?? "Invalid value."}`).join(" ");
  return details ? `${payload?.error?.message ?? fallback} ${details}` : payload?.error?.message ?? fallback;
}
