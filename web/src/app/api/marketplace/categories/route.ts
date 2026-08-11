import { NextResponse } from 'next/server';
import { CATEGORY_META, getAllPlugins } from '@/lib/marketplace/store';
import { initStore } from '@/lib/marketplace/serverStore';

export async function GET() {
  await initStore();
  const plugins = getAllPlugins();
  const categoryCounts = CATEGORY_META.map((cat) => ({
    ...cat,
    count: plugins.filter((p) => p.category === cat.id).length,
  }));
  return NextResponse.json({ categories: categoryCounts });
}
