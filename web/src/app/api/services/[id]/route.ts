import { NextResponse } from 'next/server';
import { initServicesStore, getService } from '@/lib/services/serverStore';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await initServicesStore();
  const { id } = await params;
  const service = getService(id);
  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }
  return NextResponse.json({ service });
}
