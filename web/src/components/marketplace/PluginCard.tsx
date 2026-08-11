import Link from 'next/link';
import { StarIcon, ChartAverageIcon, FlashIcon } from 'hugeicons-react';
import type { Plugin } from '@/lib/marketplace/types';
import { getCategoryMeta, formatPrice, formatNumber } from '@/lib/marketplace/utils';

interface Props {
  plugin: Plugin;
}

export default function PluginCard({ plugin }: Props) {
  const cat = getCategoryMeta(plugin.category);
  return (
    <Link href={`/marketplace/plugins/${plugin.id}`} className="mp-card">
      <div className="mp-card-top">
        <span className="mp-card-cat" style={{ color: cat.color, background: cat.bgColor }}>
          {cat.label}
        </span>
        <span className="mp-card-price">
          <FlashIcon size={13} />
          {formatPrice(plugin.price)}/use
        </span>
      </div>
      <h3>{plugin.displayName}</h3>
      <p>{plugin.description}</p>
      <div className="mp-tags">
        {plugin.tags.slice(0, 3).map((t) => (
          <span key={t} className="mp-tag">#{t}</span>
        ))}
      </div>
      <div className="mp-card-foot">
        <div>
          <StarIcon size={13} />
          <span><b>{plugin.rating.toFixed(1)}</b> ({plugin.reviewCount})</span>
        </div>
        <div>
          <ChartAverageIcon size={13} />
          <span>{formatNumber(plugin.usageCount)} uses</span>
        </div>
      </div>
      <div className="mp-card-author">by {plugin.authorName}</div>
    </Link>
  );
}
