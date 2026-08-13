import type { Plugin, Review, PlatformStats, CategoryMeta } from './types';

// NOTE: This module must stay free of Node-only imports (fs, path, …) because
// client components import CATEGORY_META / helpers from here. JSON persistence
// for published plugins lives in lib/marketplace/serverStore.ts and is
// orchestrated ONLY by the server API route handlers in app/api/marketplace/*.

export const PLUGINS: Plugin[] = [];


export const REVIEWS: Review[] = [];

export const CATEGORY_META: CategoryMeta[] = [
  { id: 'logistics', label: 'Logistics', description: 'Shipping, tracking, and supply chain', color: '#EA580C', bgColor: '#FFF7ED', count: 0 },
  { id: 'finance', label: 'Finance', description: 'Payments, invoicing, and FX data', color: '#16A34A', bgColor: '#DCFCE7', count: 0 },
  { id: 'data', label: 'Data', description: 'Real-world data oracles and feeds', color: '#3B82F6', bgColor: '#EFF6FF', count: 0 },
  { id: 'language', label: 'Language', description: 'Translation and NLP processing', color: '#9333EA', bgColor: '#F5F3FF', count: 0 },
  { id: 'communication', label: 'Communication', description: 'Notifications and messaging', color: '#EC4899', bgColor: '#FDF2F8', count: 0 },
  { id: 'legal', label: 'Legal', description: 'Contracts, compliance, and risk', color: '#475569', bgColor: '#F1F5F9', count: 0 },
  { id: 'energy', label: 'Energy', description: 'IoT, smart grid, and sustainability', color: '#CA8A04', bgColor: '#FEFCE8', count: 0 },
  { id: 'analytics', label: 'Analytics', description: 'Sentiment, market, and data analysis', color: '#4F46E5', bgColor: '#EEF2FF', count: 0 },
  { id: 'healthcare', label: 'Healthcare', description: 'Medical workflows and compliance', color: '#DC2626', bgColor: '#FEF2F2', count: 0 },
  { id: 'iot', label: 'IoT', description: 'Device connectivity and automation', color: '#0D9488', bgColor: '#F0FDFA', count: 0 },
];

export function getPlatformStats(): PlatformStats {
  const all = getAllPlugins();
  const totalInstalls = all.reduce((sum, p) => sum + p.usageCount, 0);
  const totalVolume = all.reduce((sum, p) => sum + p.usageCount * p.price, 0);
  return {
    totalPlugins: all.length,
    totalInstalls,
    totalDevelopers: new Set(all.map((p) => p.author)).size,
    totalCategories: CATEGORY_META.filter((c) => c.count > 0).length,
    totalVolume,
  };
}

// ---------------------------------------------------------------------------
// Dynamic (user-published) plugin store — in-memory, seeded from disk by the
// API routes via `hydrateDynamicPlugins` + lib/marketplace/serverStore.ts.
// ---------------------------------------------------------------------------
const dynamicPlugins: Plugin[] = [];
let nextId = PLUGINS.length + 1;

/** Called by server API routes once, with plugins loaded from disk. */
export function hydrateDynamicPlugins(saved: Plugin[]): void {
  dynamicPlugins.length = 0;
  dynamicPlugins.push(...saved);
  nextId = PLUGINS.length + dynamicPlugins.length + 1;
}

/** Current dynamic plugins (for persistence writes). */
export function getDynamicPlugins(): Plugin[] {
  return [...dynamicPlugins];
}

export function getAllPlugins(): Plugin[] {
  return [...PLUGINS, ...dynamicPlugins];
}

export function getPluginById(id: string): Plugin | undefined {
  return getAllPlugins().find((p) => p.id === id);
}

export function getPluginsByCategory(category: string): Plugin[] {
  return getAllPlugins().filter((p) => p.category === category);
}

export function getFeaturedPlugins(): Plugin[] {
  return getAllPlugins().filter((p) => p.featured);
}

export function searchPlugins(query: string): Plugin[] {
  const q = query.trim().toLowerCase();
  if (!q) return getAllPlugins();
  return getAllPlugins().filter(
    (p) =>
      p.displayName.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q)
  );
}

export function addPlugin(data: Omit<Plugin, 'id' | 'usageCount' | 'rating' | 'reviewCount' | 'createdAt' | 'updatedAt' | 'active' | 'featured'>, id?: string): Plugin {
  const plugin: Plugin = {
    ...data,
    id: id ?? String(nextId++),
    usageCount: 0,
    rating: 0,
    reviewCount: 0,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
    active: true,
    featured: false,
  };
  dynamicPlugins.push(plugin);
  return plugin;
}

export function getReviewsForPlugin(pluginId: string): Review[] {
  return REVIEWS.filter((r) => r.pluginId === pluginId);
}
