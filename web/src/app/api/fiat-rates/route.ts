import { NextResponse } from 'next/server';

let cache: { rates: Record<string, number>; at: number } | null = null;
const TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cache.at < TTL) {
      return NextResponse.json({ rates: cache.rates });
    }

    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) {
      throw new Error(`Failed to fetch rates: ${response.statusText}`);
    }

    const data = await response.json();
    const rates = data.rates;
    
    if (rates) {
      cache = { rates, at: now };
    }

    return NextResponse.json({ rates });
  } catch (error) {
    console.error('Error fetching fiat rates:', error);
    return NextResponse.json({ rates: null }, { status: 500 });
  }
}
