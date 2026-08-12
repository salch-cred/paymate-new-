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

// Real mainnet chain IDs supported by the cross-chain settlement verifier.
const chains = [
  { id: 56, name: "Binance (BSC)", icon: <img src="https://cryptologos.cc/logos/bnb-bnb-logo.svg" alt="BNB" style={{width: 20, height: 20}} />, symbol: "BNB", decimals: 18 },
  { id: 8453, name: "Base", icon: <img src="https://avatars.githubusercontent.com/u/108554348?v=4" alt="Base" style={{width: 20, height: 20, borderRadius: '50%'}} />, symbol: "ETH", decimals: 18 },
  { id: 10, name: "Optimism", icon: <img src="https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg" alt="OP" style={{width: 20, height: 20}} />, symbol: "ETH", decimals: 18 },
  { id: 42161, name: "Arbitrum", icon: <img src="https://cryptologos.cc/logos/arbitrum-arb-logo.svg" alt="ARB" style={{width: 20, height: 20}} />, symbol: "ETH", decimals: 18 },
  { id: 137, name: "Polygon", icon: <img src="https://cryptologos.cc/logos/polygon-matic-logo.svg" alt="POL" style={{width: 20, height: 20}} />, symbol: "POL", decimals: 18 },
  { id: 43114, name: "Avalanche", icon: <img src="https://cryptologos.cc/logos/avalanche-avax-logo.svg" alt="AVAX" style={{width: 20, height: 20}} />, symbol: "AVAX", decimals: 18 },
  { id: 250, name: "Fantom", icon: <img src="https://cryptologos.cc/logos/fantom-ftm-logo.svg" alt="FTM" style={{width: 20, height: 20}} />, symbol: "FTM", decimals: 18 },
  { id: 42220, name: "Celo", icon: <img src="https://cryptologos.cc/logos/celo-celo-logo.svg" alt="CELO" style={{width: 20, height: 20}} />, symbol: "CELO", decimals: 18 },
];

/** Adds a 3% buffer so the settlement covers the invoice amount even if the
 *  native price drifts between the quote and the confirmed transaction. */
const VALUE_BUFFER = 1.03;

export function ClawUpModal({ isOpen, onClose, onSuccess, amountUsd, freelancerAddress }: ClawUpModalProps) {
  const [step, setStep] = useState<"select" | "bridging" | "done">("select");
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [prices, setPrices] = useState<Record<number, number | null>>({});
  const [amountOut, setAmountOut] = useState<string | null>(null);
  
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

    } catch (e: any) {
      console.error(e);
      setStep("select");
      alert(`Transaction failed: ${e?.shortMessage || e?.message || "User rejected or insufficient funds."}`);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: 'var(--ink)', color: 'white', padding: '4px', borderRadius: '6px' }}>
              <Icon name="network" size={14} />
            </div>
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
                Pay from any network. Your wallet will send <b>${amountUsd.toLocaleString()}</b>{" "}worth of the
                network&apos;s native token directly to the freelancer, and our backend cryptographically verifies
                the value on-chain before settling on GOAT.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '35vh', overflowY: 'auto', padding: '2px' }}>
                {chains.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => selectChain(c.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px', borderRadius: '12px',
                      border: selectedChain === c.id ? '2px solid var(--ink)' : '1px solid var(--line)',
                      background: selectedChain === c.id ? 'rgba(0,0,0,0.02)' : 'white',
                      cursor: 'pointer', fontSize: '16px', fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span>{c.icon}</span> {c.name}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
                      {selectedChain === c.id && amountOut ? `≈ ${amountOut} ${c.symbol}` : c.symbol}
                    </span>
                  </button>
                ))}
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
