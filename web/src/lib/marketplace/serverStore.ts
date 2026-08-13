import { promises as fs } from 'fs';
import path from 'path';
import { hydrateDynamicPlugins, getDynamicPlugins, addPlugin } from './store';
import type { Plugin } from './types';
import { listPlugins, upsertPlugin } from '@/lib/db';

/**
 * Server-only layer that ties the pure in-memory store (store.ts) to durable
 * persistence. Import this ONLY from API route handlers / server components —
 * it pulls in Node's `fs` and the Postgres-backed db layer.
 *
 * Persistence order:
 *   1. Postgres (`plugins` table) — the source of truth. Published plugins
 *      survive cold starts / restarts on serverless (Vercel) and multi-instance
 *      deploys.
 *   2. JSON file (`data/marketplace-plugins.json`) — legacy fallback used only
 *      when Postgres is unreachable (e.g. local dev without DATABASE_URL).
 *   3. In-memory only — last resort; plugins are lost on restart, but the
 *      marketplace still functions for the current process.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'marketplace-plugins.json');

async function loadDynamicPluginsFromFile(): Promise<Plugin[]> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveDynamicPluginsToFile(plugins: Plugin[]): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(plugins, null, 2), 'utf8');
  } catch (e) {
    console.error('[marketplace] JSON persistence unavailable, keeping in-memory:', (e as Error).message);
  }
}

/** Load the persisted plugin set into the in-memory store (exactly once). */
async function loadIntoMemory(): Promise<void> {
  try {
    const saved = await listPlugins();
    hydrateDynamicPlugins(saved);
    return;
  } catch (e) {
    console.warn('[marketplace] Postgres unavailable, falling back to JSON file:', (e as Error).message);
  }
  // Legacy fallback: the JSON file (works for local dev without a database).
  const fromFile = await loadDynamicPluginsFromFile();
  hydrateDynamicPlugins(fromFile);
}

let storeReady: Promise<void> | null = null;

/** Hydrate the in-memory store from durable storage exactly once. */
export function initStore(): Promise<void> {
  if (!storeReady) {
    storeReady = loadIntoMemory().catch((e) => {
      // Never let a storage failure break the marketplace UI — degrade to
      // in-memory (empty) and log.
      console.error('[marketplace] failed to hydrate store, using in-memory only:', e);
      hydrateDynamicPlugins([]);
    });
  }
  return storeReady;
}

/** Add a plugin and persist it durably (Postgres first, JSON file as fallback). */
export async function addPluginPersisted(
  data: Omit<Plugin, 'id' | 'usageCount' | 'rating' | 'reviewCount' | 'createdAt' | 'updatedAt' | 'active' | 'featured'>
): Promise<Plugin> {
  await initStore();
  // Caller-supplied id so concurrent serverless instances can never collide
  // on the shared sequential counter (each instance hydrates its own count).
  const id = `p_${Date.now().toString(36)}${cryptoRandomSuffix()}`;
  const plugin = addPlugin(data, id);

  try {
    await upsertPlugin(plugin);
    return plugin;
  } catch (e) {
    console.warn('[marketplace] Postgres write failed, falling back to JSON file:', (e as Error).message);
  }

  await saveDynamicPluginsToFile(getDynamicPlugins());
  return plugin;
}

function cryptoRandomSuffix(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
