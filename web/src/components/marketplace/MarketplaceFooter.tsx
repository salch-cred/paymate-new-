import Link from 'next/link';
import { Icon } from '@/components/icons';

export default function MarketplaceFooter() {
  return (
    <footer className="mp-footer">
      <div className="mp-footer-inner">
        <div className="mp-footer-top">
          <div className="mp-footer-brand">
            <Link href="/dashboard/marketplace" className="mp-brand">
              <span className="brand-mark"><span /></span>
              <b>SkillMint</b>
            </Link>
            <p>
              The on-chain plugin marketplace for AI agents. Publish a capability once, earn 80%
              royalty on every autonomous use via x402 on GOAT Network.
            </p>
          </div>
          <div className="mp-footer-col">
            <h4>Marketplace</h4>
            <Link href="/dashboard/marketplace/plugins">Browse all plugins</Link>
            <Link href="/dashboard/marketplace/plugins?category=logistics">Logistics</Link>
            <Link href="/dashboard/marketplace/plugins?category=finance">Finance</Link>
            <Link href="/dashboard/marketplace/plugins?category=data">Data</Link>
          </div>
          <div className="mp-footer-col">
            <h4>Build</h4>
            <Link href="/dashboard/marketplace/publish">Publish a plugin</Link>
            <Link href="/dashboard/marketplace/dashboard">Developer dashboard</Link>
            <a href="https://goat.network" target="_blank" rel="noopener noreferrer">GOAT Network</a>
            <a href="https://x402.org" target="_blank" rel="noopener noreferrer">x402 Protocol</a>
          </div>
        </div>
        <div className="mp-footer-bottom">
          <span>© 2026 SkillMint · Part of PayMate · Built on GOAT Network.</span>
          <div className="mp-footer-badges">
            <span><Icon name="bolt" size={12} />x402</span>
            <span><Icon name="shield" size={12} />ERC-8004</span>
            <span><Icon name="network" size={12} />GOAT</span>
          </div>
          <Link href="/" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} /> Back to PayMate</Link>
        </div>
      </div>
    </footer>
  );
}
