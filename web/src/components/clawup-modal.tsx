"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { useSwitchChain, useSendTransaction, useAccount } from "wagmi";
import { parseEther } from "viem";

interface ClawUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (txHash: string, chainId: number) => void;
  amountUsd: number;
  freelancerAddress: string;
}

// Real mainnet chain IDs supported by the cross-chain settlement verifier
// (chain.ts CROSS_CHAIN_CLIENTS + price.ts). Logos are the chains' OFFICIAL
// brand marks, vendored locally in /public/chain-logos (sources: Trust Wallet
// assets repo, CoinGecko, cryptologos) so they never depend on a third-party CDN.
const chainIcon = (name: string) =>
  `/chain-logos/${name}${name === "mode" || name === "zora" ? ".jpg" : ".png"}`

const chains = [
  { id: 1, name: "Ethereum", logo: "ethereum", symbol: "ETH", decimals: 18 },
  { id: 56, name: "BNB Smart Chain", logo: "bsc", symbol: "BNB", decimals: 18 },
  { id: 8453, name: "Base", logo: "base", symbol: "ETH", decimals: 18 },
  { id: 10, name: "Optimism", logo: "optimism", symbol: "ETH", decimals: 18 },
  { id: 42161, name: "Arbitrum One", logo: "arbitrum", symbol: "ETH", decimals: 18 },
  { id: 137, name: "Polygon", logo: "polygon", symbol: "POL", decimals: 18 },
  { id: 43114, name: "Avalanche", logo: "avalanche", symbol: "AVAX", decimals: 18 },
  { id: 250, name: "Fantom", logo: "fantom", symbol: "FTM", decimals: 18 },
  { id: 42220, name: "Celo", logo: "celo", symbol: "CELO", decimals: 18 },
  { id: 324, name: "zkSync Era", logo: "zksync", symbol: "ETH", decimals: 18 },
  { id: 59144, name: "Linea", logo: "linea", symbol: "ETH", decimals: 18 },
  { id: 534352, name: "Scroll", logo: "scroll", symbol: "ETH", decimals: 18 },
  { id: 81457, name: "Blast", logo: "blast", symbol: "ETH", decimals: 18 },
  { id: 1088, name: "Metis", logo: "metis", symbol: "METIS", decimals: 18 },
  { id: 5000, name: "Mantle", logo: "mantle", symbol: "MNT", decimals: 18 },
  { id: 204, name: "opBNB", logo: "opbnb", symbol: "BNB", decimals: 18 },
  { id: 1101, name: "Polygon zkEVM", logo: "polygon-zkevm", symbol: "ETH", decimals: 18 },
  { id: 42170, name: "Arbitrum Nova", logo: "arbitrum-nova", symbol: "ETH", decimals: 18 },
  { id: 25, name: "Cronos", logo: "cronos", symbol: "CRO", decimals: 18 },
  { id: 100, name: "Gnosis", logo: "gnosis", symbol: "xDAI", decimals: 18 },
  { id: 1313161554, name: "Aurora", logo: "aurora", symbol: "ETH", decimals: 18 },
  { id: 1284, name: "Moonbeam", logo: "moonbeam", symbol: "GLMR", decimals: 18 },
  { id: 1285, name: "Moonriver", logo: "moonriver", symbol: "MOVR", decimals: 18 },
  { id: 8217, name: "Klaytn", logo: "klaytn", symbol: "KLAY", decimals: 18 },
  { id: 1666600000, name: "Harmony", logo: "harmony", symbol: "ONE", decimals: 18 },
  { id: 1116, name: "Core", logo: "core", symbol: "CORE", decimals: 18 },
  { id: 252, name: "Fraxtal", logo: "fraxtal", symbol: "frxETH", decimals: 18 },
  { id: 34443, name: "Mode", logo: "mode", symbol: "ETH", decimals: 18 },
  { id: 13371, name: "Immutable zkEVM", logo: "immutable-zkevm", symbol: "IMX", decimals: 18 },
  { id: 40, name: "Telos", logo: "telos", symbol: "TLOS", decimals: 18 },
  { id: 82, name: "Meter", logo: "meter", symbol: "MTR", decimals: 18 },
  { id: 592, name: "Astar", logo: "astar", symbol: "ASTR", decimals: 18 },
  { id: 66, name: "OKC", logo: "okc", symbol: "OKT", decimals: 18 },
  { id: 2222, name: "Kava", logo: "kava", symbol: "KAVA", decimals: 18 },
  { id: 30, name: "Rootstock", logo: "rootstock", symbol: "RBTC", decimals: 18 },
  { id: 146, name: "Sonic", logo: "sonic", symbol: "S", decimals: 18 },
  { id: 7777777, name: "Zora", logo: "zora", symbol: "ETH", decimals: 18 },
];

/** Adds a 3% buffer so the settlement covers the invoice amount even if the
 *  native price drifts between the quote and the confirmed transaction. */
const VALUE_BUFFER = 1.03;

export function ClawUpModal({ isOpen, onClose, onSuccess, amountUsd, freelancerAddress }: ClawUpModalProps) {
  const [step, setStep] = useState<"select" | "bridging" | "done">("select");
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [prices, setPrices] = useState<Record<number, number | null>>({});
  const [amountOut, setAmountOut] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const filteredChains = search.trim()
    ? chains.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()) || c.symbol.toLowerCase().includes(search.trim().toLowerCase()))
    : chains;
  
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { isConnected, chainId } = useAccount();

  const selectChain = async (chainId: number) => {
    setSelectedChain(chainId);
    // Load the live native-token price for this chain and quote the exact
    // amount needed to cover the invoice (buffered for price drift).
    try {
      const res = await fetch("/api/prices");
      const data = await res.json();
      setPrices(data.prices || {});
      const usd = data.prices?.[chainId];
      if (typeof usd === "number" && usd > 0) {
        const units = ((amountUsd * VALUE_BUFFER) / usd).toFixed(6);
        setAmountOut(units);
      } else {
        setAmountOut(null);
      }
    } catch {
      setPrices({});
      setAmountOut(null);
    }
  };

  const handlePay = async () => {
    if (!selectedChain || !isConnected) return;
    const usd = prices[selectedChain];
    if (!amountOut || !usd) {
      alert("Could not fetch the live native price for this network. Try again in a moment.");
      return;
    }
    try {
      setStep("bridging");
      
      // 1. Physically switch the wallet to the external network if needed
      if (chainId !== selectedChain) {
        if (switchChainAsync) {
          await switchChainAsync({ chainId: selectedChain });
        } else {
          throw new Error("Your wallet does not support automatic network switching. Please switch manually.");
        }
      }
      
      // 2. Send the invoice's REAL value in the source chain's native token to
      // the freelancer's wallet.
      const txHash = await sendTransactionAsync({
        chainId: selectedChain,
        to: freelancerAddress as `0x${string}`,
        value: parseEther(amountOut),
      });

      // 3. Pass the real transaction hash back so the backend can verify it across RPCs!
      setStep("done");
      setTimeout(() => onSuccess(txHash, selectedChain), 1500);

    } catch (e) {
      console.error(e);
      setStep("select");
      const err = e as { shortMessage?: string; message?: string };
      alert(`Transaction failed: ${err?.shortMessage || err?.message || "User rejected or insufficient funds."}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--surface)',
        width: '100%', maxWidth: '400px',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        border: '1px solid var(--line)'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/clawup-mark-orange.svg"
              alt="ClawUp"
              style={{ width: 26, height: 26, borderRadius: '6px' }}
            />
            <span style={{ fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '18px' }}>ClawUp Cross-Chain</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <Icon name="close" size={20} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {step === "select" && (
            <div>
              <p style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '14px' }}>
                Pay from any of <b>{chains.length} networks</b>. Your wallet will send <b>${amountUsd.toLocaleString()}</b>{" "}worth of the
                network&apos;s native token directly to the freelancer, and our backend cryptographically verifies
                the value on-chain before settling on GOAT.
              </p>
              <input
                type="text"
                placeholder={`Search ${chains.length} networks…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input"
                style={{ width: '100%', height: '38px', marginBottom: '10px', fontSize: '13px' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '35vh', overflowY: 'auto', padding: '2px' }}>
                {filteredChains.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => selectChain(c.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: '12px',
                      border: selectedChain === c.id ? '2px solid var(--ink)' : '1px solid var(--line)',
                      background: selectedChain === c.id ? 'rgba(0,0,0,0.02)' : 'white',
                      cursor: 'pointer', fontSize: '15px', fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={chainIcon(c.logo)}
                        alt={c.name}
                        loading="lazy"
                        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e5e5', flexShrink: 0 }}
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                        }}
                      />
                      {c.name}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
                      {selectedChain === c.id && amountOut ? `≈ ${amountOut} ${c.symbol}` : c.symbol}
                    </span>
                  </button>
                ))}
                {filteredChains.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '13px' }}>
                    No network matches “{search}”.
                  </div>
                )}
              </div>
              <button 
                onClick={handlePay}
                disabled={!selectedChain || !amountOut}
                className="button button-primary" 
                style={{ width: '100%', marginTop: '24px', opacity: selectedChain && amountOut ? 1 : 0.5 }}
              >
                Send {amountOut ? `${amountOut} ` : ""}{chains.find(c => c.id === selectedChain)?.symbol || "…"} ({`$${amountUsd.toLocaleString()}`} value)
              </button>
            </div>
          )}

          {step === "bridging" && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div className="draft-spinner" style={{ borderColor: 'var(--ink)', borderTopColor: 'transparent', width: '32px', height: '32px', margin: '0 auto 16px' }} />
              <h3 style={{ marginBottom: '8px' }}>Waiting for Signature...</h3>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Please approve the transaction in your wallet on the {chains.find(c => c.id === selectedChain)?.name} network.</p>
            </div>
          )}

          {step === "done" && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ background: '#e7f5ec', color: '#317454', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Icon name="check" size={24} />
              </div>
              <h3 style={{ marginBottom: '8px' }}>Transaction Confirmed!</h3>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Passing the cryptographic receipt to our backend for GOAT settlement...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
