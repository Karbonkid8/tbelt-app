import type { User } from 'firebase/auth';

const apiBaseUrl = import.meta.env.VITE_FIELDOPS_API_BASE_URL ?? 'https://api.fracplotter.com/v1';

export type Site = { id: string; name: string };
export type Alert = { type: string; severity: 'critical' | 'warning'; resourceId: string; resourceName: string; message: string; recordedAtIso: string | null };
export type Reading = { pressurePsi: number; temperatureF: number | null; recordedAtIso: string; by: string | null };
export type Trailer = { id: string; position: number; trailerNumber: string; active: boolean; latestReading: Reading | null };
export type Container = { id: string; name: string; type: string; area: string; chemical: string; strap: number | null; updatedAtIso: string | null };
export type Well = { id: string; name: string; color: string; plannedStages: number };
export type Dashboard = { site: Site; activeWells: Well[]; trailers: Trailer[]; inventory: { containers: Container[]; lowIsoThresholdInches: number; alerts: Alert[] }; alerts: Alert[]; generatedAtIso: string };
export type CngStage = { id: string; wellId: string; wellName: string; stageNumber: number; mscf: number; note: string | null; endedAtIso: string | null; by: string | null };
export type CngStageTotals = { totalMscf: number; completedStageCount: number; stages: CngStage[]; generatedAtIso: string };
export type CngTrailerTrend = { trailerId: string; trailerNumber: string; readings: Reading[] };
export type CngDispatch = { id: string; sourceTrailerId: string; sourceTrailerNumber: string; replacementTrailerNumber: string | null; status: 'dispatched' | 'arrived' | 'cancelled'; travelTimeHours: number; targetArrivalPsi: number; dispatchedAtIso: string; projectedArrivalIso: string; dispatchedBy: string; resolvedAtIso: string | null; resolvedBy: string | null };
export type CreateCngDispatch = { sourceTrailerId: string; replacementTrailerNumber?: string; travelTimeHours: number; targetArrivalPsi: number };

async function request<T>(user: User, path: string, init?: RequestInit): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(response.status === 401 ? 'Your administrator session is no longer authorized.' : body?.message ?? `API request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const fieldOpsApi = {
  listSites: (user: User) => request<Site[]>(user, '/sites'),
  dashboard: (user: User, siteId: string) => request<Dashboard>(user, `/sites/${encodeURIComponent(siteId)}/dashboard`),
  activeWells: (user: User, siteId: string) => request<Well[]>(user, `/sites/${encodeURIComponent(siteId)}/wells`),
  cngStageTotals: (user: User, siteId: string) => request<CngStageTotals>(user, `/sites/${encodeURIComponent(siteId)}/cng/stages`),
  cngPressureTrends: (user: User, siteId: string) => request<CngTrailerTrend[]>(user, `/sites/${encodeURIComponent(siteId)}/cng/pressure-trends`),
  cngDispatches: (user: User, siteId: string) => request<CngDispatch[]>(user, `/sites/${encodeURIComponent(siteId)}/cng/dispatches`),
  cngDispatchHistory: (user: User, siteId: string) => request<CngDispatch[]>(user, `/sites/${encodeURIComponent(siteId)}/cng/dispatches/history`),
  createCngDispatch: (user: User, siteId: string, dispatch: CreateCngDispatch) => request<CngDispatch>(user, `/sites/${encodeURIComponent(siteId)}/cng/dispatches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dispatch) }),
  resolveCngDispatch: (user: User, siteId: string, dispatchId: string, status: 'arrived' | 'cancelled') => request<CngDispatch>(user, `/sites/${encodeURIComponent(siteId)}/cng/dispatches/${encodeURIComponent(dispatchId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }),
};
