const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function fetchText(url: string, extraHeaders: Record<string, string> = {}, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, ...extraHeaders },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} al obtener ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson<T>(url: string, extraHeaders: Record<string, string> = {}, timeoutMs = 10000): Promise<T> {
  const text = await fetchText(url, { Accept: 'application/json', ...extraHeaders }, timeoutMs);
  return JSON.parse(text) as T;
}
