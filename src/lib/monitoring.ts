export type SnapshotMarket = {
  name: string;
  countryCode: string;
  importValue: number | null;
  growth: number | null;
  priority: number | null;
};
export type MarketSnapshot = { version: 1; savedAt: string; items: SnapshotMarket[] };
export type MonitoringChange = {
  hasBaseline: boolean;
  changedMarkets: Array<{ name: string; importDeltaPct: number | null; growthDeltaPts: number | null; priorityDelta: number | null }>;
  newMarkets: string[];
  removedMarkets: string[];
};
type MarketLike = { countryCode?: string | number | null; country?: string | null; marketName?: string | null; market?: string | null; importValue?: number | null; yoyGrowth?: number | null; growthRate?: number | null; opportunity?: { score?: number | null } | null; priority?: number | null };
export function buildMarketSnapshot(markets: MarketLike[]): MarketSnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    items: markets.map((m) => ({
      name: m.country || m.marketName || m.market || "Unknown market",
      countryCode: String(m.countryCode ?? ""),
      importValue: typeof m.importValue === "number" && Number.isFinite(m.importValue) ? m.importValue : null,
      growth: typeof (m.yoyGrowth ?? m.growthRate) === "number" && Number.isFinite(m.yoyGrowth ?? m.growthRate) ? (m.yoyGrowth ?? m.growthRate) as number : null,
      priority: typeof (m.opportunity?.score ?? m.priority) === "number" && Number.isFinite(m.opportunity?.score ?? m.priority) ? (m.opportunity?.score ?? m.priority) as number : null,
    })),
  };
}
export function compareMarketSnapshots(previous: MarketSnapshot | null, current: MarketSnapshot): MonitoringChange {
  if (!previous || previous.version !== 1) return { hasBaseline: false, changedMarkets: [], newMarkets: current.items.slice(0, 6).map((x) => x.name), removedMarkets: [] };
  const before = new Map(previous.items.map((x) => [x.countryCode || x.name, x]));
  const after = new Map(current.items.map((x) => [x.countryCode || x.name, x]));
  const changedMarkets = current.items.flatMap((item) => {
    const old = before.get(item.countryCode || item.name);
    if (!old) return [];
    const importDeltaPct = old.importValue && old.importValue !== 0 && item.importValue != null ? Number((((item.importValue - old.importValue) / Math.abs(old.importValue)) * 100).toFixed(1)) : null;
    const growthDeltaPts = old.growth != null && item.growth != null ? Number((item.growth - old.growth).toFixed(1)) : null;
    const priorityDelta = old.priority != null && item.priority != null ? Number((item.priority - old.priority).toFixed(1)) : null;
    return importDeltaPct !== 0 || growthDeltaPts !== 0 || priorityDelta !== 0 ? [{ name: item.name, importDeltaPct, growthDeltaPts, priorityDelta }] : [];
  }).sort((a, b) => Math.abs(b.priorityDelta ?? 0) + Math.abs(b.growthDeltaPts ?? 0) + Math.abs(b.importDeltaPct ?? 0) - (Math.abs(a.priorityDelta ?? 0) + Math.abs(a.growthDeltaPts ?? 0) + Math.abs(a.importDeltaPct ?? 0))).slice(0, 6);
  const newMarkets = current.items.filter((x) => !before.has(x.countryCode || x.name)).slice(0, 6).map((x) => x.name);
  const removedMarkets = previous.items.filter((x) => !after.has(x.countryCode || x.name)).slice(0, 6).map((x) => x.name);
  return { hasBaseline: true, changedMarkets, newMarkets, removedMarkets };
}
const STORAGE_KEY = "ecc:market-snapshot:v1";
export function readSavedMarketSnapshot(): MarketSnapshot | null {
  if (typeof window === "undefined") return null;
  try { const raw = window.localStorage.getItem(STORAGE_KEY); if (!raw) return null; const parsed = JSON.parse(raw) as MarketSnapshot; return parsed?.version === 1 && Array.isArray(parsed.items) ? parsed : null; } catch { return null; }
}
export function saveMarketSnapshot(snapshot: MarketSnapshot) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch { /* optional */ }
}
