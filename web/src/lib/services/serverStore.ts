import { promises as fs } from 'fs';
import path from 'path';
import {
  hydrateServices, hydrateOrders, hydrateJobs, hydrateProposals,
  addService, createOrder, updateOrder, getOrders, getServices, getService, getOrder,
  recordServiceCompletion, createJob, updateJob, createProposal, updateProposal,
  getJobs, getProposals,
} from './store';
import type { Service, ServiceOrder, JobPost, JobProposal } from './types';
import { listServicesFromDb, upsertService, listOrdersFromDb, upsertOrder, listJobsFromDb, upsertJobPost, listProposalsFromDb, upsertJobProposal } from '@/lib/db';

/**
 * Server-only layer tying the pure in-memory services/orders store to durable
 * persistence. Import ONLY from API route handlers / server components.
 *
 * Persistence order (mirrors the plugin marketplace):
 *   1. Postgres (`services` / `service_orders` tables) — source of truth.
 *   2. JSON files (`data/services.json`, `data/orders.json`) — local dev
 *      fallback when DATABASE_URL is unset.
 *   3. In-memory only — last resort.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const PROPOSALS_FILE = path.join(DATA_DIR, 'proposals.json');

async function readJson<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJson<T>(file: string, items: T[]): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(items, null, 2), 'utf8');
  } catch (e) {
    console.error('[services] JSON persistence unavailable, keeping in-memory:', (e as Error).message);
  }
}

async function loadIntoMemory(): Promise<void> {
  try {
    const [savedServices, savedOrders, savedJobs, savedProposals] = await Promise.all([
      listServicesFromDb(), listOrdersFromDb(), listJobsFromDb(), listProposalsFromDb(),
    ]);
    hydrateServices(savedServices);
    hydrateOrders(savedOrders);
    hydrateJobs(savedJobs);
    hydrateProposals(savedProposals);
    return;
  } catch (e) {
    console.warn('[services] Postgres unavailable, falling back to JSON files:', (e as Error).message);
  }
  const [fromFileSvc, fromFileOrd, fromFileJobs, fromFileProps] = await Promise.all([
    readJson<Service>(SERVICES_FILE), readJson<ServiceOrder>(ORDERS_FILE),
    readJson<JobPost>(JOBS_FILE), readJson<JobProposal>(PROPOSALS_FILE),
  ]);
  hydrateServices(fromFileSvc);
  hydrateOrders(fromFileOrd);
  hydrateJobs(fromFileJobs);
  hydrateProposals(fromFileProps);
}

let storeReady: Promise<void> | null = null;

/** Hydrate the in-memory stores from durable storage exactly once. */
export function initServicesStore(): Promise<void> {
  if (!storeReady) {
    storeReady = loadIntoMemory().catch((e) => {
      console.error('[services] failed to hydrate store, using in-memory only:', e);
      hydrateServices([]);
      hydrateOrders([]);
    });
  }
  return storeReady;
}

export async function addServicePersisted(
  data: Omit<Service, 'id' | 'rating' | 'reviewCount' | 'completedCount' | 'createdAt' | 'updatedAt' | 'active'>
): Promise<Service> {
  await initServicesStore();
  const service = addService(data);
  try {
    await upsertService(service);
    return service;
  } catch (e) {
    console.warn('[services] Postgres write failed, falling back to JSON file:', (e as Error).message);
  }
  await writeJson(SERVICES_FILE, getServices());
  return service;
}

export async function persistService(service: Service): Promise<void> {
  try {
    await upsertService(service);
    return;
  } catch (e) {
    console.warn('[services] Postgres write failed, falling back to JSON file:', (e as Error).message);
  }
  await writeJson(SERVICES_FILE, getServices());
}

export async function createOrderPersisted(
  data: Pick<ServiceOrder, 'serviceId' | 'serviceTitle' | 'category' | 'buyer' | 'provider' | 'amountUsd' | 'scope'>
): Promise<ServiceOrder> {
  await initServicesStore();
  const order = createOrder(data);
  try {
    await upsertOrder(order);
    return order;
  } catch (e) {
    console.warn('[services] Postgres write failed, falling back to JSON file:', (e as Error).message);
  }
  await writeJson(ORDERS_FILE, getOrders());
  return order;
}

export async function persistOrder(order: ServiceOrder): Promise<void> {
  try {
    await upsertOrder(order);
    return;
  } catch (e) {
    console.warn('[services] Postgres write failed, falling back to JSON file:', (e as Error).message);
  }
  await writeJson(ORDERS_FILE, getOrders());
}

/** Apply a patch to an order, persist it, and return the updated order. */
export async function patchOrder(id: string, patch: Parameters<typeof updateOrder>[1]): Promise<ServiceOrder | null> {
  await initServicesStore();
  const updated = updateOrder(id, patch);
  if (!updated) return null;
  await persistOrder(updated);
  return updated;
}

export async function markServiceCompleted(serviceId: string, rating: number | null): Promise<Service | null> {
  await initServicesStore();
  const updated = recordServiceCompletion(serviceId, rating);
  if (!updated) return null;
  await persistService(updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Jobs + proposals persistence
// ---------------------------------------------------------------------------

export async function createJobPersisted(
  data: Pick<JobPost, 'title' | 'description' | 'category' | 'budgetMin' | 'budgetMax' | 'deadlineDays' | 'client' | 'clientName' | 'tags'>
): Promise<JobPost> {
  await initServicesStore();
  const job = createJob(data);
  try {
    await upsertJobPost(job);
    return job;
  } catch (e) {
    console.warn('[services] Postgres write failed, falling back to JSON file:', (e as Error).message);
  }
  await writeJson(JOBS_FILE, getJobs());
  return job;
}

export async function createProposalPersisted(
  data: Pick<JobProposal, 'jobId' | 'provider' | 'providerName' | 'bidUsd' | 'deliveryDays' | 'message'>
): Promise<JobProposal> {
  await initServicesStore();
  const proposal = createProposal(data);
  try {
    await upsertJobProposal(proposal);
    return proposal;
  } catch (e) {
    console.warn('[services] Postgres write failed, falling back to JSON file:', (e as Error).message);
  }
  await writeJson(PROPOSALS_FILE, getProposals());
  return proposal;
}

export async function patchJob(id: string, patch: Parameters<typeof updateJob>[1]): Promise<JobPost | null> {
  await initServicesStore();
  const updated = updateJob(id, patch);
  if (!updated) return null;
  try {
    await upsertJobPost(updated);
  } catch (e) {
    console.warn('[services] Postgres write failed, falling back to JSON file:', (e as Error).message);
    await writeJson(JOBS_FILE, getJobs());
  }
  return updated;
}

export async function patchProposal(id: string, patch: Parameters<typeof updateProposal>[1]): Promise<JobProposal | null> {
  await initServicesStore();
  const updated = updateProposal(id, patch);
  if (!updated) return null;
  try {
    await upsertJobProposal(updated);
  } catch (e) {
    console.warn('[services] Postgres write failed, falling back to JSON file:', (e as Error).message);
    await writeJson(PROPOSALS_FILE, getProposals());
  }
  return updated;
}

export { getService, getOrder };
