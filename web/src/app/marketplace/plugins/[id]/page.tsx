import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StarIcon } from 'hugeicons-react';
import { getPluginById, getReviewsForPlugin } from '@/lib/marketplace/store';
import { initStore } from '@/lib/marketplace/serverStore';
import { getCategoryMeta, formatPrice, formatNumber, generateInstallCode, timeAgo, truncateAddress } from '@/lib/marketplace/utils';
import { Icon } from '@/components/icons';
import CopyButton from './CopyButton';

export default async function PluginDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await initStore();
  const { id } = await params;
  const plugin = getPluginById(id);
  if (!plugin) notFound();
  const reviews = getReviewsForPlugin(id);
  const cat = getCategoryMeta(plugin.category);
  const installCode = generateInstallCode(plugin.name);

  return (
    <div style={{ padding: '34px 24px 90px', position: 'relative', zIndex: 1 }}>
      <div className="mp-detail">
        <div className="mp-detail-main">
          <Link href="/marketplace/plugins" className="mp-back">
            <Icon name="arrow" size={15} style={{ transform: 'rotate(180deg)' }} />
            Back to Marketplace
          </Link>

          <div className="mp-plugin-head">
            <div className="mp-plugin-top">
              <span className="mp-card-cat" style={{ color: cat.color, background: cat.bgColor }}>{cat.label}</span>
              {plugin.featured && <span className="mp-featured">Featured</span>}
            </div>
            <h1 className="mp-plugin-name">{plugin.displayName}</h1>
            <p className="mp-plugin-desc">{plugin.description}</p>
            <div className="mp-meta-row">
              <div className="mp-meta-item"><StarIcon size={15} /><strong>{plugin.rating.toFixed(1)}</strong><span>({plugin.reviewCount} reviews)</span></div>
              <span className="mp-meta-dot" />
              <div className="mp-meta-item"><Icon name="chart" size={15} /><span>{formatNumber(plugin.usageCount)} total uses</span></div>
              <span className="mp-meta-dot" />
              <div className="mp-meta-item"><Icon name="package" size={15} /><span>v{plugin.version}</span></div>
            </div>
          </div>

          <div className="mp-panel">
            <h2>About this plugin</h2>
            <p className="mp-long-desc">{plugin.longDescription}</p>
          </div>

          {plugin.tags.length > 0 && (
            <div className="mp-panel">
              <h2>Tags</h2>
              <div className="mp-tags">{plugin.tags.map((t) => <span key={t} className="mp-tag">#{t}</span>)}</div>
            </div>
          )}

          <div className="mp-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="mp-codeblock" style={{ borderRadius: 0 }}>
              <div className="mp-codeblock-head">
                <span><i />TypeScript / AgentKit</span>
                <CopyButton code={installCode} />
              </div>
              <pre><code>{installCode}</code></pre>
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="mp-panel">
              <h2>Reviews</h2>
              {reviews.map((r) => (
                <div key={r.id} className="mp-review">
                  <div className="mp-review-top">
                    <div className="mp-reviewer">
                      <div className="mp-avatar">{r.authorName[0]}</div>
                      <div>
                        <div className="mp-reviewer-name">{r.authorName}</div>
                        <div className="mp-reviewer-addr">{truncateAddress(r.author)}</div>
                      </div>
                    </div>
                    <div>
                      <div className="mp-stars">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <StarIcon key={i} size={13} color={i < r.rating ? '#F59E0B' : '#E5E7EB'} />
                        ))}
                      </div>
                      <span className="mp-review-date">{timeAgo(r.createdAt)}</span>
                    </div>
                  </div>
                  <p className="mp-review-comment">{r.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside>
          <div className="mp-purchase glass-heavy">
            <div className="mp-price-row">
              <div>
                <div className="mp-price-label">Price per use</div>
                <div className="mp-price">
                  <Icon name="bolt" size={19} />
                  {formatPrice(plugin.price)}
                  <small>USDC</small>
                </div>
              </div>
              <span className="mp-x402-pill">VIA x402</span>
            </div>
            <Link href="/marketplace/publish" className="mp-use-btn">
              Use in your agent <Icon name="arrow" size={16} />
            </Link>
            <p className="mp-purchase-note">Pay per use via x402 micropayments. No API key needed. Royalties flow to the developer automatically.</p>
          </div>

          <div className="mp-info-card">
            <h3>Plugin details</h3>
            <div className="mp-info-row"><span className="mp-info-label"><Icon name="user" size={14} /> Developer</span><span className="mp-info-value">{plugin.authorName}</span></div>
            <div className="mp-info-row"><span className="mp-info-label"><Icon name="wallet" size={14} /> Address</span><span className="mp-info-value mono">{truncateAddress(plugin.author)}</span></div>
            <div className="mp-info-row"><span className="mp-info-label"><Icon name="calendar" size={14} /> Published</span><span className="mp-info-value">{timeAgo(plugin.createdAt)}</span></div>
            <div className="mp-info-row"><span className="mp-info-label"><Icon name="calendar" size={14} /> Updated</span><span className="mp-info-value">{timeAgo(plugin.updatedAt)}</span></div>
            <div className="mp-info-row"><span className="mp-info-label"><Icon name="package" size={14} /> Version</span><span className="mp-info-value">{plugin.version}</span></div>
            <div className="mp-info-row"><span className="mp-info-label"><Icon name="copy" size={14} /> IPFS</span><span className="mp-info-value mono">{plugin.ipfsHash.slice(0, 20)}…</span></div>
            {(plugin.githubUrl || plugin.docsUrl) && (
              <div className="mp-ext-links">
                {plugin.githubUrl && <a href={plugin.githubUrl} target="_blank" rel="noopener noreferrer" className="mp-ext-link"><Icon name="code" size={15} /> GitHub</a>}
                {plugin.docsUrl && <a href={plugin.docsUrl} target="_blank" rel="noopener noreferrer" className="mp-ext-link"><Icon name="globe" size={15} /> Docs</a>}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
