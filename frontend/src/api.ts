export interface OutputFile { name: string; url: string }
export interface Job {
  id: string; status: 'queued' | 'running' | 'succeeded' | 'failed';
  stage: string; progress: number | null; error: string | null; files: OutputFile[];
}
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${response.status}). Check the local API log and retry.`);
  }
  return response.json() as Promise<T>;
}
export function localFileUrl(url: string): string {
  const parsed = new URL(url, window.location.origin);
  if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith('/api/jobs/')) {
    throw new Error('The API returned a file outside the local job endpoint.');
  }
  return parsed.href;
}
export function isWav(file: OutputFile): boolean { return /\.wav$/i.test(file.name); }
