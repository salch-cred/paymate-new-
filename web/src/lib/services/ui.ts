import type { OrderStatus } from './types';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_funding: 'Awaiting funding',
  funded: 'Funded · in progress',
  delivered: 'Delivered · awaiting review',
  disputed: 'Disputed · arbitration',
  completed: 'Completed',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  pending_funding: '#B45309',
  funded: '#2563EB',
  delivered: '#7C3AED',
  disputed: '#DC2626',
  completed: '#16A34A',
  refunded: '#64748B',
  cancelled: '#94A3B8',
};

export function shortAddress(address: string, start = 6, end = 4): string {
  if (!address) return '';
  if (address.length <= start + end + 1) return address;
  return `${address.slice(0, start)}…${address.slice(-end)}`;
}

export function timeAgo(ts: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatUsd(value: number): string {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
