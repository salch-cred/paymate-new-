import type { Metadata } from 'next';
import './marketplace.css';
import MarketplaceHeader from '@/components/marketplace/MarketplaceHeader';
import MarketplaceFooter from '@/components/marketplace/MarketplaceFooter';

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
    <div className="mp-shell">
      <div className="mp-ambient mp-ambient-one" />
      <div className="mp-ambient mp-ambient-two" />
      <div className="mp-ambient mp-ambient-three" />
      <MarketplaceHeader />
      <main>{children}</main>
      <MarketplaceFooter />
    </div>
  );
}
