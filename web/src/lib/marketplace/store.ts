import type { Plugin, Review, PlatformStats, CategoryMeta } from './types';

// NOTE: This module must stay free of Node-only imports (fs, path, …) because
// client components import CATEGORY_META / helpers from here. JSON persistence
// for published plugins lives in lib/marketplace/serverStore.ts and is
// orchestrated ONLY by the server API route handlers in app/api/marketplace/*.

export const PLUGINS: Plugin[] = [
  {
    id: '1',
    name: 'logistics-tracker',
    displayName: 'Logistics Tracker',
    description: 'Real-time shipment tracking for FedEx, UPS, DHL, and USPS with live location updates and ETA prediction.',
    longDescription: 'The Logistics Tracker plugin gives your AI agent real-time visibility into any shipment across major carriers. Simply pass a tracking number and carrier name — the agent receives current location, estimated delivery window, exception alerts, and full tracking history. Built for autonomous supply chain agents that need to monitor orders without human intervention.',
    category: 'logistics',
    price: 0.002,
    author: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    authorName: 'ShipBot Labs',
    ipfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
    usageCount: 4821,
    rating: 4.8,
    reviewCount: 127,
    tags: ['shipping', 'tracking', 'fedex', 'ups', 'dhl', 'logistics'],
    createdAt: '2026-01-15',
    updatedAt: '2026-07-20',
    version: '2.1.0',
    active: true,
    featured: true,
    githubUrl: 'https://github.com/shipbot-labs/logistics-tracker',
    docsUrl: 'https://docs.shipbotlabs.io/logistics-tracker',
  },
  {
    id: '2',
    name: 'weather-oracle',
    displayName: 'Weather Oracle',
    description: 'Hyper-local weather data, 7-day forecasts, and severe weather alerts for any location worldwide.',
    longDescription: 'Weather Oracle provides your AI agent with accurate, real-time meteorological data for any coordinate or city. Access current conditions, hourly and 7-day forecasts, air quality index, UV index, and severe weather alerts. Ideal for logistics agents optimizing routes, agriculture agents, or any workflow where weather impacts decisions.',
    category: 'data',
    price: 0.001,
    author: '0x2b3c4d5e6f7890abcdef1234567890abcdef1234',
    authorName: 'OracleStack',
    ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    usageCount: 9203,
    rating: 4.9,
    reviewCount: 243,
    tags: ['weather', 'forecast', 'climate', 'oracle', 'real-time'],
    createdAt: '2026-02-01',
    updatedAt: '2026-08-01',
    version: '3.0.1',
    active: true,
    featured: true,
    githubUrl: 'https://github.com/oraclestack/weather-oracle',
  },
  {
    id: '3',
    name: 'invoice-generator',
    displayName: 'Invoice Generator',
    description: 'Autonomously generate, send, and track professional PDF invoices. Supports multi-currency and tax calculations.',
    longDescription: 'Invoice Generator enables your agent to create professional invoices without any human interaction. The agent provides line items, client details, tax rates, and payment terms — a branded PDF is generated and optionally emailed to the client. Supports 30+ currencies, VAT/GST calculations, recurring invoice scheduling, and payment status tracking via x402.',
    category: 'finance',
    price: 0.005,
    author: '0x3c4d5e6f7890abcdef1234567890abcdef123456',
    authorName: 'FinanceKit',
    ipfsHash: 'QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB5B7qFBde',
    usageCount: 2341,
    rating: 4.7,
    reviewCount: 89,
    tags: ['invoice', 'billing', 'pdf', 'finance', 'accounting'],
    createdAt: '2026-02-20',
    updatedAt: '2026-07-15',
    version: '1.4.2',
    active: true,
    featured: true,
    githubUrl: 'https://github.com/financekit/invoice-generator',
  },
  {
    id: '4',
    name: 'multilang-translate',
    displayName: 'Multilang Translate',
    description: 'Neural machine translation across 120+ languages with cultural context awareness and tone preservation.',
    longDescription: 'Multilang Translate goes beyond word-for-word translation. It uses neural models to preserve tone, idioms, and cultural context across 120+ languages. Perfect for agents handling international customer communications, document localization, or cross-border agent-to-agent commerce where instructions need accurate translation.',
    category: 'language',
    price: 0.001,
    author: '0x4d5e6f7890abcdef1234567890abcdef12345678',
    authorName: 'LinguaFlow',
    ipfsHash: 'QmSoLV4Bgbd87LRLaex3fQ3GodEWQFJKGfV18Wq6K1SMHH',
    usageCount: 7654,
    rating: 4.6,
    reviewCount: 198,
    tags: ['translation', 'language', 'nlp', 'localization', 'multilingual'],
    createdAt: '2026-03-05',
    updatedAt: '2026-07-30',
    version: '2.3.0',
    active: true,
    featured: false,
  },
  {
    id: '5',
    name: 'smart-notify',
    displayName: 'Smart Notify',
    description: 'Multi-channel notifications via Email, Telegram, Discord, Slack, and SMS triggered by your agent autonomously.',
    longDescription: 'Smart Notify lets your AI agent send rich notifications across all major channels without storing credentials. Supports templated messages, priority levels, read receipts, and retry logic. The agent defines recipient, channel, message content, and priority — Smart Notify handles delivery and returns confirmation.',
    category: 'communication',
    price: 0.001,
    author: '0x5e6f7890abcdef1234567890abcdef1234567890',
    authorName: 'NotifyLabs',
    ipfsHash: 'QmSoLV4Bgbd87LRLaex3fQ3GodEWQFJKGfV18Wq6K1SMHH',
    usageCount: 5432,
    rating: 4.5,
    reviewCount: 156,
    tags: ['notifications', 'email', 'telegram', 'slack', 'sms', 'alerts'],
    createdAt: '2026-03-10',
    updatedAt: '2026-08-05',
    version: '1.9.0',
    active: true,
    featured: true,
  },
  {
    id: '6',
    name: 'contract-analyzer',
    displayName: 'Contract Analyzer',
    description: 'AI-powered legal contract parsing, risk scoring, and clause extraction for autonomous legal review.',
    longDescription: 'Contract Analyzer allows your agent to parse any legal document and return structured risk assessments, problematic clause identification, missing standard clauses, jurisdiction analysis, and a plain-language summary. Trained on 2M+ contracts across US, EU, and UK jurisdictions. Critical for procurement agents and B2B commerce automation.',
    category: 'legal',
    price: 0.01,
    author: '0x6f7890abcdef1234567890abcdef123456789012',
    authorName: 'LexBot AI',
    ipfsHash: 'QmT78z1rNNhG5nBrHHQ7GhFriGp3Kdi79PmHkpjpaBiRiQ',
    usageCount: 1203,
    rating: 4.9,
    reviewCount: 67,
    tags: ['legal', 'contracts', 'compliance', 'risk', 'nlp'],
    createdAt: '2026-04-01',
    updatedAt: '2026-07-28',
    version: '1.2.0',
    active: true,
    featured: false,
    githubUrl: 'https://github.com/lexbot-ai/contract-analyzer',
  },
  {
    id: '7',
    name: 'energy-monitor',
    displayName: 'Energy Monitor',
    description: 'Real-time IoT energy consumption monitoring, carbon footprint calculation, and optimization recommendations.',
    longDescription: 'Energy Monitor connects your agent to smart grid data and IoT sensors to track energy consumption in real time. The agent receives current draw, peak hours, carbon intensity, cost projections, and AI-generated optimization actions. Designed for facility management agents, green energy trading bots, and ESG compliance automation.',
    category: 'energy',
    price: 0.002,
    author: '0x7890abcdef1234567890abcdef12345678901234',
    authorName: 'GridFlow',
    ipfsHash: 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345uxfkvZoBUsE32uj',
    usageCount: 876,
    rating: 4.4,
    reviewCount: 42,
    tags: ['energy', 'iot', 'carbon', 'sustainability', 'smart-grid'],
    createdAt: '2026-04-15',
    updatedAt: '2026-07-10',
    version: '1.0.3',
    active: true,
    featured: false,
  },
  {
    id: '8',
    name: 'sentiment-radar',
    displayName: 'Sentiment Radar',
    description: 'Real-time sentiment analysis across social media, news, and reviews with trend scoring and signal alerts.',
    longDescription: 'Sentiment Radar gives your agent a live pulse on market, brand, or topic sentiment. Ingests Twitter/X, Reddit, news feeds, and review platforms — returns sentiment scores, volume trends, key narratives, and influencer signals. Ideal for trading agents monitoring token sentiment, brand agents, or market intelligence workflows.',
    category: 'analytics',
    price: 0.003,
    author: '0x890abcdef1234567890abcdef123456789012345',
    authorName: 'RadarLabs',
    ipfsHash: 'QmVkNgM5D3jkVFqBFbBi8LRpGqRKYYJL3caxEkxSmxCk5E',
    usageCount: 3201,
    rating: 4.7,
    reviewCount: 104,
    tags: ['sentiment', 'analytics', 'social-media', 'nlp', 'trading'],
    createdAt: '2026-05-01',
    updatedAt: '2026-08-03',
    version: '2.0.1',
    active: true,
    featured: true,
  },
  {
    id: '9',
    name: 'patient-flow',
    displayName: 'Patient Flow',
    description: 'HIPAA-compliant hospital resource allocation — bed management, equipment scheduling, and staff coordination.',
    longDescription: 'Patient Flow is a HIPAA-compliant plugin that allows healthcare AI agents to coordinate hospital resources without manual dispatch. The agent queries bed availability, equipment status, and staff schedules — and can trigger automated allocation actions. Full audit trail is maintained on-chain via ERC-8004 for compliance.',
    category: 'healthcare',
    price: 0.008,
    author: '0x90abcdef1234567890abcdef12345678901234ab',
    authorName: 'MedAgent Inc',
    ipfsHash: 'QmW2WQi7Yc4GVYH8S4v6HqUepRqKDqJVn4UyR7DH4xFTgj',
    usageCount: 543,
    rating: 4.8,
    reviewCount: 31,
    tags: ['healthcare', 'hipaa', 'hospital', 'compliance', 'scheduling'],
    createdAt: '2026-05-20',
    updatedAt: '2026-08-06',
    version: '1.1.0',
    active: true,
    featured: false,
    docsUrl: 'https://medagent.io/patient-flow-docs',
  },
  {
    id: '10',
    name: 'currency-pulse',
    displayName: 'Currency Pulse',
    description: 'Live FX rates, crypto prices, and cross-asset conversion for 150+ currencies and 1000+ digital assets.',
    longDescription: 'Currency Pulse gives your agent accurate, real-time exchange rates across traditional forex and crypto markets. Returns bid/ask spreads, 24h change, volume data, and conversion calculations. Aggregates data from 12 sources to minimize latency and manipulation. Essential for any DeFi or cross-border payment agent.',
    category: 'finance',
    price: 0.001,
    author: '0x0abcdef1234567890abcdef12345678901234abcd',
    authorName: 'PulseDAO',
    ipfsHash: 'QmX5hMMNMnFfD4ZtKGnpxVuL2VJBmAZuWAHEjPqRJnhEYK',
    usageCount: 11023,
    rating: 4.9,
    reviewCount: 312,
    tags: ['forex', 'crypto', 'exchange-rate', 'defi', 'finance'],
    createdAt: '2026-01-28',
    updatedAt: '2026-08-09',
    version: '4.2.0',
    active: true,
    featured: true,
    githubUrl: 'https://github.com/pulsedao/currency-pulse',
  },
];

export const REVIEWS: Review[] = [
  { id: 'r1', pluginId: '1', author: '0xaaa...111', authorName: 'CargoAI', rating: 5, comment: 'Absolutely essential for our logistics agent. Tracking updates come through in under 2 seconds.', createdAt: '2026-07-10' },
  { id: 'r2', pluginId: '1', author: '0xbbb...222', authorName: 'FleetBot', rating: 5, comment: 'Handles edge cases like customs holds and weather delays gracefully. Solid plugin.', createdAt: '2026-06-28' },
  { id: 'r3', pluginId: '1', author: '0xccc...333', authorName: 'ShipSmart', rating: 4, comment: 'Works great for domestic shipments. International tracking could use more carriers.', createdAt: '2026-06-15' },
  { id: 'r4', pluginId: '2', author: '0xddd...444', authorName: 'AgriBot', rating: 5, comment: 'We use this for crop planning. The 7-day forecast accuracy is impressive.', createdAt: '2026-07-22' },
  { id: 'r5', pluginId: '3', author: '0xeee...555', authorName: 'FreelanceAI', rating: 5, comment: 'My agent generates and sends invoices autonomously. Clients love the professional look.', createdAt: '2026-07-18' },
  { id: 'r6', pluginId: '10', author: '0xfff...666', authorName: 'TradingBot9', rating: 5, comment: 'Lowest latency FX data I have found on any blockchain plugin. Sub-200ms responses consistently.', createdAt: '2026-08-01' },
];

export const CATEGORY_META: CategoryMeta[] = [
  { id: 'logistics', label: 'Logistics', description: 'Shipping, tracking, and supply chain', color: '#EA580C', bgColor: '#FFF7ED', count: 2 },
  { id: 'finance', label: 'Finance', description: 'Payments, invoicing, and FX data', color: '#16A34A', bgColor: '#DCFCE7', count: 2 },
  { id: 'data', label: 'Data', description: 'Real-world data oracles and feeds', color: '#3B82F6', bgColor: '#EFF6FF', count: 1 },
  { id: 'language', label: 'Language', description: 'Translation and NLP processing', color: '#9333EA', bgColor: '#F5F3FF', count: 1 },
  { id: 'communication', label: 'Communication', description: 'Notifications and messaging', color: '#EC4899', bgColor: '#FDF2F8', count: 1 },
  { id: 'legal', label: 'Legal', description: 'Contracts, compliance, and risk', color: '#475569', bgColor: '#F1F5F9', count: 1 },
  { id: 'energy', label: 'Energy', description: 'IoT, smart grid, and sustainability', color: '#CA8A04', bgColor: '#FEFCE8', count: 1 },
  { id: 'analytics', label: 'Analytics', description: 'Sentiment, market, and data analysis', color: '#4F46E5', bgColor: '#EEF2FF', count: 1 },
  { id: 'healthcare', label: 'Healthcare', description: 'Medical workflows and compliance', color: '#DC2626', bgColor: '#FEF2F2', count: 1 },
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

export function addPlugin(data: Omit<Plugin, 'id' | 'usageCount' | 'rating' | 'reviewCount' | 'createdAt' | 'updatedAt' | 'active' | 'featured'>): Plugin {
  const plugin: Plugin = {
    ...data,
    id: String(nextId++),
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
