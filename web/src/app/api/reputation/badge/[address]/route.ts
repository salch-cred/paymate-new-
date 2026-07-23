import { getReputationData } from "@/lib/chain";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const resolvedParams = await params;
  const address = resolvedParams.address;
  if (!address || !address.startsWith("0x")) {
    return new Response("Invalid Address", { status: 400 });
  }

  const rep = await getReputationData(address);
  
  // Determine tier based on jobs completed or score
  let tier = "Bronze";
  let color1 = "#CD7F32";
  let color2 = "#A0522D";
  
  if (rep.jobsCompleted >= 5 || rep.score >= 100) {
    tier = "Silver";
    color1 = "#C0C0C0";
    color2 = "#808080";
  }
  if (rep.jobsCompleted >= 20 || rep.score >= 500) {
    tier = "Gold";
    color1 = "#FFD700";
    color2 = "#DAA520";
  }
  if (rep.jobsCompleted >= 50 || rep.score >= 2000) {
    tier = "Platinum";
    color1 = "#E5E4E2";
    color2 = "#7A7A7A";
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1A1A1A" />
      <stop offset="100%" stop-color="#0F0F0F" />
    </linearGradient>
    <linearGradient id="badgeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}" />
      <stop offset="100%" stop-color="${color2}" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <rect width="300" height="400" rx="20" fill="url(#bg)" stroke="${color1}" stroke-width="2"/>
  
  <!-- Network Logo Placeholder -->
  <circle cx="150" cy="80" r="40" fill="none" stroke="url(#badgeGlow)" stroke-width="4" filter="url(#glow)"/>
  <path d="M 135 70 L 165 70 L 150 95 Z" fill="url(#badgeGlow)"/>
  
  <!-- Tier & Title -->
  <text x="150" y="160" font-family="sans-serif" font-size="28" font-weight="900" fill="url(#badgeGlow)" text-anchor="middle" letter-spacing="2">${tier.toUpperCase()}</text>
  <text x="150" y="190" font-family="sans-serif" font-size="12" font-weight="600" fill="#AAAAAA" text-anchor="middle" letter-spacing="1">VERIFIED CREATOR</text>
  
  <!-- Stats -->
  <rect x="30" y="220" width="240" height="120" rx="10" fill="#222" stroke="#333" stroke-width="1"/>
  
  <text x="50" y="250" font-family="sans-serif" font-size="10" font-weight="bold" fill="#777" letter-spacing="1">REPUTATION SCORE</text>
  <text x="50" y="275" font-family="sans-serif" font-size="24" font-weight="900" fill="#FFF">${rep.score}</text>
  
  <text x="170" y="250" font-family="sans-serif" font-size="10" font-weight="bold" fill="#777" letter-spacing="1">JOBS DONE</text>
  <text x="170" y="275" font-family="sans-serif" font-size="24" font-weight="900" fill="#FFF">${rep.jobsCompleted}</text>
  
  <text x="50" y="305" font-family="sans-serif" font-size="10" font-weight="bold" fill="#777" letter-spacing="1">TOTAL EARNED</text>
  <text x="50" y="325" font-family="sans-serif" font-size="16" font-weight="900" fill="#52a879">$${rep.totalEarnedUsd}</text>
  
  <!-- Footer -->
  <text x="150" y="375" font-family="sans-serif" font-size="9" fill="#555" text-anchor="middle">Secured by GOAT Network ERC-8004</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=60, s-maxage=60"
    }
  });
}
