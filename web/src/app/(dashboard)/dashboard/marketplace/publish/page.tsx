'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletClient } from 'wagmi';
import { getAddress } from 'viem';
import { CATEGORY_META } from '@/lib/marketplace/store';
import type { Category } from '@/lib/marketplace/types';
import { Icon } from '@/components/icons';
import { WalletConnectMenu } from '@/components/wallet-connect-menu';
import { useWallet } from '@/lib/useWallet';

// SECURITY (audit fix 2026-08-13): publishing now requires a wallet-signed,
// timestamp-bound proof of ownership over authorAddress (mirrors /developers
// and the invoice-cancellation fix) so nobody can publish under a wallet
// address they don't control.
const PUBLISH_MESSAGE = (authorAddress: string, ts: number) => `PayMate marketplace publish by ${authorAddress} at ${ts}`;

const EMPTY_FORM = {
  displayName: '',
  description: '',
  longDescription: '',
  category: 'logistics' as Category,
  price: '',
  authorName: '',
  authorAddress: '',
  ipfsHash: '',
  version: '1.0.0',
  tags: '',
  githubUrl: '',
  docsUrl: '',
};

export default function PublishPage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const { data: walletClient } = useWalletClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!address || !walletClient) {
      setError('Connect the wallet you want to publish under first.');
      return;
    }
    setSubmitting(true);
    try {
      const authorAddress = getAddress(address);
      const ts = Date.now();
      const message = PUBLISH_MESSAGE(authorAddress.toLowerCase(), ts);
      const signature = await walletClient.signMessage({ message, account: address as `0x${string}` });
      const res = await fetch('/api/marketplace/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          authorAddress,
          authorProof: { message, signature, ts },
          price: parseFloat(form.price),
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          name: form.displayName.toLowerCase().replace(/\s+/g, '-'),
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/marketplace/plugins'), 2200);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Something went wrong. Check the form and try again.');
      }
    } catch {
      setError('Network error — could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mp-success">
        <div className="mp-success-card">
          <div className="mp-success-orb"><Icon name="check" size={36} /></div>
          <h2>Plugin published!</h2>
          <p>Your plugin is now live on the marketplace. Redirecting you to browse…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mp-page-head">
        <span className="section-kicker"><span className="pulse-dot" />DEVELOPER PORTAL</span>
        <h1 className="mp-page-title">Publish a plugin</h1>
        <p className="mp-page-sub">
          Share your AgentKit plugin with the community. Earn 80% royalties on every use via x402.
        </p>
      </div>

      <div className="mp-content">
        <div className="mp-publish-layout">
          <form id="publish-form" onSubmit={handleSubmit} style={{ minWidth: 0 }}>
            <div className="mp-form-section">
              <h2><span className="mp-form-num">01</span>Basic information</h2>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="displayName">Plugin name *</label>
                  <input id="displayName" type="text" placeholder="e.g. Logistics Tracker" required value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="category">Category *</label>
                  <select id="category" required value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
                    {CATEGORY_META.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field full">
                  <label htmlFor="description">Short description *</label>
                  <input id="description" type="text" placeholder="One sentence describing what this plugin does" required maxLength={200} value={form.description} onChange={(e) => set('description', e.target.value)} />
                </div>
                <div className="field full">
                  <label htmlFor="longDescription">Full description</label>
                  <textarea id="longDescription" placeholder="Detailed description of features, use cases, and how it works" value={form.longDescription} onChange={(e) => set('longDescription', e.target.value)} />
                </div>
                <div className="field full">
                  <label htmlFor="tags">Tags</label>
                  <input id="tags" type="text" placeholder="shipping, tracking, fedex (comma separated)" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="mp-form-section">
              <h2><span className="mp-form-num">02</span>Pricing &amp; deployment</h2>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="price">Price per use (USDC) *</label>
                  <input id="price" type="number" step="0.001" min="0.001" placeholder="0.001" required value={form.price} onChange={(e) => set('price', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="version">Version</label>
                  <input id="version" type="text" placeholder="1.0.0" value={form.version} onChange={(e) => set('version', e.target.value)} />
                </div>
                <div className="field full">
                  <label htmlFor="ipfsHash">IPFS hash *</label>
                  <input id="ipfsHash" type="text" placeholder="QmXoypizjW3WknFiJnKLwHCnL72vedxjQk…" required value={form.ipfsHash} onChange={(e) => set('ipfsHash', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="mp-form-section">
              <h2><span className="mp-form-num">03</span>Developer info</h2>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="authorName">Developer / team name *</label>
                  <input id="authorName" type="text" placeholder="e.g. ShipBot Labs" required value={form.authorName} onChange={(e) => set('authorName', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="authorAddress">Wallet address (ERC-8004) *</label>
                  <input id="authorAddress" type="text" placeholder="Connect your wallet" required readOnly value={isConnected && address ? address : ''} />
                  {!isConnected && <div style={{ marginTop: 8 }}><WalletConnectMenu triggerClassName="button button-outline" triggerLabel="Connect wallet" /></div>}
                </div>
                <div className="field">
                  <label htmlFor="githubUrl">GitHub URL</label>
                  <input id="githubUrl" type="url" placeholder="https://github.com/…" value={form.githubUrl} onChange={(e) => set('githubUrl', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="docsUrl">Documentation URL</label>
                  <input id="docsUrl" type="url" placeholder="https://…" value={form.docsUrl} onChange={(e) => set('docsUrl', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="mp-form-footer">
              <button type="submit" id="publish-submit" className="button button-primary" disabled={submitting}>
                {submitting ? 'Publishing…' : 'Publish plugin'} <Icon name="send" size={15} />
              </button>
              <p className="mp-terms">
                By publishing, you agree that your plugin is functional and safe for autonomous agents to use.
              </p>
            </div>
            {error && <div className="error-box" style={{ marginTop: 14 }}>{error}</div>}
          </form>

          <aside>
            <div className="mp-info-box">
              <h3><Icon name="wallet" size={18} /> How royalties work</h3>
              <ul className="mp-info-list">
                <li><Icon name="check" size={13} /> You earn <b>80%</b> of every use</li>
                <li><Icon name="check" size={13} /> SkillMint takes a <b>20%</b> platform fee</li>
                <li><Icon name="check" size={13} /> Paid instantly to your wallet on each use</li>
                <li><Icon name="check" size={13} /> No minimum withdrawal amount</li>
              </ul>
            </div>
            <div className="mp-info-box">
              <h3><Icon name="code" size={18} /> Plugin requirements</h3>
              <ul className="mp-info-list">
                <li><Icon name="check" size={13} /> TypeScript / JavaScript package</li>
                <li><Icon name="check" size={13} /> Must be uploaded to IPFS first</li>
                <li><Icon name="check" size={13} /> Compatible with the AgentKit plugin interface</li>
                <li><Icon name="check" size={13} /> No malicious code — reviewed by the community</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
