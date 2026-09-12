import type { User } from 'firebase/auth';

const apiBaseUrl = import.meta.env.VITE_FIELDOPS_API_BASE_URL ?? 'https://api.fracplotter.com/v1';

export type Site = { id: string; name: string };
export type Alert = { type: string; severity: 'critical' | 'warning'; resourceId: string; resourceName: string; message: string; recordedAtIso: string | null };
export type Reading = { pressurePsi: number; temperatureF: number | null; recordedAtIso: string; by: string | null };
export type Trailer = { id: string; position: number; trailerNumber: string; active: boolean; latestReading: Reading | null };
export type Container = { id: string; name: string; type: string; area: string; chemical: string; strap: number | null; updatedAtIso: string | null };
export type Dashboard = { site: Site; activeWells: { id: string; name: string }[]; trailers: Trailer[]; inventory: { containers: Container[]; lowIsoThresholdInches: number; alerts: Alert[] }; alerts: Alert[]; generatedAtIso: string };

async function request<T>(user: User, path: string): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(`${apiBaseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(response.status === 401 ? 'Your administrator session is no longer authorized.' : `API request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export const fieldOpsApi = {
  listSites: (user: User) => request<Site[]>(user, '/sites'),
  dashboard: (user: User, siteId: string) => request<Dashboard>(user, `/sites/${encodeURIComponent(siteId)}/dashboard`),
};
