import { NextRequest, NextResponse } from 'next/server';
import { getPluginById, getReviewsForPlugin } from '@/lib/marketplace/store';
import { initStore } from '@/lib/marketplace/serverStore';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initStore();
  const { id } = await params;
  const plugin = getPluginById(id);
  if (!plugin) {
    return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
  }
  const reviews = getReviewsForPlugin(id);
  return NextResponse.json({ plugin, reviews });
}
