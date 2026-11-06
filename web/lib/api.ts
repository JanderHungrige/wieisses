// Fetch wrapper for both pages: same-origin cookies, the X-Wieisses header on every write
// (the server's CSRF check), and errors as ApiError with the server's German message.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;
  raw?: Blob;
  token?: string;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? (options.json !== undefined || options.raw ? 'POST' : 'GET');
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['X-Wieisses'] = '1';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.raw) {
    headers['Content-Type'] = options.raw.type || 'application/octet-stream';
    body = options.raw;
  }
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'network', 'Keine Verbindung zum Server.');
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, err.error ?? 'server_error', err.message ?? 'Da ist etwas schiefgegangen.');
  }
  return data as T;
}
