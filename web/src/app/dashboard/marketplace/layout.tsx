import type { Metadata } from 'next';
import './marketplace.css';

export const metadata: Metadata = {
  title: { default: 'Marketplace — Mint New Abilities', template: '%s · SkillMint' },
  description:
    'The on-chain plugin marketplace for AI agents on GOAT Network. Publish capabilities, discover plugins, and pay autonomously via x402. Mint new abilities for your agent.',
  openGraph: {
    title: 'SkillMint — Plugin Marketplace for AI Agents',
    description: 'The on-chain plugin marketplace for AgentKit on GOAT Network.',
    type: 'website',
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mp-dashboard-shell">
      <main>{children}</main>
    </div>
  );
}
