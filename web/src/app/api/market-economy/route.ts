import { NextResponse } from 'next/server';
import { initServicesStore } from '@/lib/services/serverStore';
import { getMarketSnapshot } from '@/lib/services/store';

export async function GET() {
  try {
    await initServicesStore();
    const snapshot = getMarketSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('[api/market-economy] failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
