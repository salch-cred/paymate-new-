'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';

export default function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handle = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — ignore.
    }
  };

  return (
    <button onClick={handle} className={`mp-copy-btn ${copied ? 'copied' : ''}`} aria-label="Copy install code">
      <Icon name={copied ? 'check' : 'copy'} size={13} />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
