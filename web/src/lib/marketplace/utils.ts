import type { Category } from './types';
import { CATEGORY_META } from './store';

export function formatPrice(price: number): string {
  // Sub-cent prices are shown in full (e.g. $0.001) — never as an ambiguous
  // "$1.0m" that reads like a million dollars.
  if (price < 0.01) return `$${(+price.toFixed(4)).toString()}`;
  return `$${(+price.toFixed(3)).toString()}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function formatUSDC(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getCategoryMeta(category: Category) {
  return CATEGORY_META.find((c) => c.id === category) ?? {
    id: category,
    label: category,
    description: '',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    count: 0,
  };
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function generateInstallCode(pluginName: string): string {
  return `import { createGoatAgent } from '@goat-sdk/core';
import { SkillMintClient } from 'skillmint-sdk';

const skillMint = new SkillMintClient({
  agentId: process.env.ERC8004_AGENT_ID!,
  wallet: process.env.AGENT_WALLET_PRIVATE_KEY!,
});

const agent = createGoatAgent({
  plugins: [
    await skillMint.loadPlugin('${pluginName}'),
  ],
});

// The plugin is now available as a tool
const result = await agent.run('Your task here...');`;
}
