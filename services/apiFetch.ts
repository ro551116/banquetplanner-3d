export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch<T>(url: string, options?: ApiFetchOptions): Promise<T> {
  const { timeoutMs, ...init } = options ?? {};
  const timeoutSignal = timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs);
  const signal = timeoutSignal && init.signal
    ? AbortSignal.any([timeoutSignal, init.signal])
    : timeoutSignal ?? init.signal;
  try {
    const res = await fetch(url, {
      ...init,
      signal,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      const error = body && typeof body === 'object' && 'error' in body ? body.error : null;
      throw new ApiError(res.status, body,
        (typeof error === 'string' && error) || res.statusText || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted || (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))) {
      throw new Error('伺服器沒有回應，請稍後再試');
    }
    if (error instanceof TypeError) throw new Error('無法連線到伺服器');
    throw error;
  }
}
