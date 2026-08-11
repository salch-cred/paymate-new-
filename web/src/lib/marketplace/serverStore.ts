import { promises as fs } from 'fs';
import path from 'path';
import { hydrateDynamicPlugins, getDynamicPlugins, addPlugin } from './store';
import type { Plugin } from './types';

/**
 * Server-only layer that ties the pure in-memory store (store.ts) to JSON-file
 * persistence. Import this ONLY from API route handlers / server components —
 * it pulls in Node's `fs`.
 *
 * - Single-server / VPS / `next start`: published plugins survive restarts via
 *   `data/marketplace-plugins.json` (relative to the app working directory).
 * - Serverless (Vercel et al.): the filesystem is read-only/ephemeral, so writes
 *   silently fall back to in-memory — the app still works, just not persistent.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'marketplace-plugins.json');

async function loadDynamicPlugins(): Promise<Plugin[]> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveDynamicPlugins(plugins: Plugin[]): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(plugins, null, 2), 'utf8');
  } catch (e) {
    console.error('[marketplace] persistence unavailable, keeping in-memory:', (e as Error).message);
  }
}

let storeReady: Promise<void> | null = null;

/** Hydrate the in-memory store from disk exactly once. */
export function initStore(): Promise<void> {
  if (!storeReady) {
    storeReady = loadDynamicPlugins().then(hydrateDynamicPlugins);
  }
  return storeReady;
}

/** Add a plugin and persist the updated list (best-effort). */
export async function addPluginPersisted(
  data: Omit<Plugin, 'id' | 'usageCount' | 'rating' | 'reviewCount' | 'createdAt' | 'updatedAt' | 'active' | 'featured'>
): Promise<Plugin> {
  await initStore();
  const plugin = addPlugin(data);
  await saveDynamicPlugins(getDynamicPlugins());
  return plugin;
}
