'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/icons';

const NAV_LINKS = [
  { href: '/marketplace', label: 'Marketplace', icon: 'network' as const },
  { href: '/marketplace/plugins', label: 'Plugins', icon: 'bolt' as const },
  { href: '/marketplace/publish', label: 'Publish', icon: 'send' as const },
  { href: '/marketplace/dashboard', label: 'Dashboard', icon: 'chart' as const },
];

export default function MarketplaceHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/marketplace' ? pathname === '/marketplace' : pathname.startsWith(href);

  return (
    <nav className="mp-nav glass" aria-label="Marketplace navigation">
      <Link href="/dashboard/marketplace" className="mp-brand" onClick={() => setOpen(false)}>
        <span className="brand-mark"><span /></span>
        <span>
          <b>SkillMint</b>
          <small>ABILITIES, MINTED.</small>
        </span>
      </Link>

      <div className={`mp-nav-links ${open ? 'open' : ''}`}>
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={isActive(l.href) ? 'active' : ''} onClick={() => setOpen(false)}>
            <Icon name={l.icon} size={15} />
            {l.label}
          </Link>
        ))}
      </div>

      <div className="mp-nav-actions">
        <span className="mp-live-chip"><i />GOAT LIVE</span>
        <Link href="/dashboard/marketplace/publish" className="mp-nav-cta">Publish plugin <Icon name="arrow" size={14} /></Link>
        <button className="mp-menu-btn" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>
          <Icon name={open ? 'close' : 'menu'} size={20} />
        </button>
      </div>
    </nav>
  );
}
