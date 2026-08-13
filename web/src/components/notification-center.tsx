"use client"

import { useState, useRef, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Icon, type IconName } from '@/components/icons'

export interface Notification {
  id: string
  icon: IconName
  title: string
  message: string
  timestamp: number
  isRead: boolean
}

export function NotificationCenter() {
  const { address } = useAccount()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (address) {
      fetch(`/api/notifications?address=${address}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setNotifications(data)
          }
        })
        .catch(console.error)
    }
  }, [address])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Re-clamp the panel whenever the window resizes while open.
  useEffect(() => {
    if (!isOpen) return
    const onResize = () => {
      if (btnRef.current) positionPanel(btnRef.current)
    }
    // If the page scrolls while open, close the panel so it never floats
    // away from its anchor.
    const onScroll = () => setIsOpen(false)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [isOpen])

  function positionPanel(btn: HTMLButtonElement) {
    const width = Math.min(360, window.innerWidth - 24)
    const rect = btn.getBoundingClientRect()
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
    setPanelPos({ top: rect.bottom + 8, left, width })
  }

  function togglePanel() {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    if (btnRef.current) positionPanel(btnRef.current)
    setIsOpen(true)
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `${date} · ${time}`
  }

  return (
    <div className="notification-center" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        className="topbar-icon"
        onClick={togglePanel}
        style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="bell" size={17} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '8px',
            height: '8px',
            backgroundColor: 'var(--orange)',
            borderRadius: '50%'
          }} />
        )}
      </button>

      {isOpen && panelPos && (
        <div style={{
          position: 'fixed',
          top: panelPos.top,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: 'min(400px, calc(100vh - 120px))',
          overflowY: 'auto',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap' }}>Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              No notifications yet
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                style={{
                  padding: '14px',
                  borderBottom: '1px solid var(--line)',
                  borderLeft: n.isRead ? '3px solid transparent' : '3px solid var(--orange)',
                  background: n.isRead ? 'transparent' : 'rgba(255, 91, 46, 0.03)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{
                  width: '32px', height: '32px',
                  borderRadius: '50%',
                  background: 'var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--line)',
                  flexShrink: 0
                }}>
                  <Icon name={n.icon} size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{n.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.message}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{formatTime(n.timestamp)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
