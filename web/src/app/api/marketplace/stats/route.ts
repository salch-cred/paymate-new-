import { NextResponse } from 'next/server';
import { getPlatformStats } from '@/lib/marketplace/store';
import { initStore } from '@/lib/marketplace/serverStore';

export async function GET() {
  await initStore();
  const stats = getPlatformStats();
  return NextResponse.json(stats);
}
