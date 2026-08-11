'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/icons';
import PluginCard from '@/components/marketplace/PluginCard';
import type { Plugin } from '@/lib/marketplace/types';
import { CATEGORY_META } from '@/lib/marketplace/store';

export default function BrowsePage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('popular');

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category !== 'all') params.set('category', category);
    params.set('sort', sort);
    fetch(`/api/marketplace/plugins?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => { setPlugins(data.plugins); setLoading(false); })
      .catch((err) => { if (err?.name !== 'AbortError') setLoading(false); });
    return () => controller.abort();
  }, [query, category, sort]);

  const reset = useCallback(() => {
    setQuery('');
    setCategory('all');
    setSort('popular');
  }, []);

  return (
    <>
      <div className="mp-page-head">
        <span className="section-kicker"><span className="pulse-dot" />PLUGIN MARKETPLACE</span>
        <h1 className="mp-page-title">Discover capabilities</h1>
        <p className="mp-page-sub">
          AgentKit plugins built by the community. Pay per use with x402 — no API keys, no subscriptions.
        </p>
      </div>

      <div className="mp-toolbar">
        <div className="mp-search">
          <Icon name="search" size={16} />
          <input
            id="plugin-search"
            type="text"
            placeholder="Search plugins…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mp-select-wrap">
          <select id="category-filter" className="mp-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORY_META.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="mp-select-wrap">
          <select id="sort-select" className="mp-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="popular">Most Popular</option>
            <option value="rating">Top Rated</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low → High</option>
            <option value="price-high">Price: High → Low</option>
          </select>
        </div>
      </div>

      <div className="mp-pills">
        {['all', ...CATEGORY_META.map((c) => c.id)].map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)} className={`mp-pill ${category === cat ? 'active' : ''}`}>
            {cat === 'all' ? 'All' : CATEGORY_META.find((c) => c.id === cat)?.label ?? cat}
          </button>
        ))}
      </div>

      <div className="mp-content">
        {loading ? (
          <div className="mp-loading"><div className="mp-spinner" /><span>Loading plugins…</span></div>
        ) : (
          <>
            <div className="mp-results-info">
              {plugins.length} plugin{plugins.length !== 1 ? 's' : ''} found
            </div>
            {plugins.length === 0 ? (
              <div className="mp-empty">
                <div className="mp-empty-orb"><Icon name="bolt" size={26} /></div>
                <h3>No plugins found</h3>
                <p>Try a different search term or category</p>
                <button className="button button-outline" onClick={reset} style={{ marginTop: 8 }}>
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="mp-grid">{plugins.map((p) => <PluginCard key={p.id} plugin={p} />)}</div>
            )}
          </>
        )}
      </div>
    </>
  );
}
