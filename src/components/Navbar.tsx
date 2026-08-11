'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useState, useRef, useEffect } from 'react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile nav on route change
  useEffect(() => { setMobileNavOpen(false) }, [pathname])

  async function handleLogout() {
    setMenuOpen(false)
    setMobileNavOpen(false)
    await logout()
    router.push('/login')
  }

  const navLinks = [
    { href: '/entries', label: 'Browse' },
    { href: '/bookmarks', label: 'Bookmarks' },
    ...(user?.role === 'admin' || user?.role === 'curator'
      ? [{ href: '/entries/archived', label: 'Archived' }]
      : []),
    { href: '/entries/favorites', label: 'Favorites' },
    ...(user?.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  const isActive = (href: string) => {
    if (href === '/entries') return pathname === '/entries' || (pathname.startsWith('/entries') && !pathname.startsWith('/entries/archived') && !pathname.startsWith('/entries/favorites'))
    return pathname.startsWith(href)
  }

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link href="/entries" className="flex items-center gap-2 font-bold text-base tracking-tight flex-shrink-0">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">L</span>
          <span className="text-gray-900">LinkLib</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-0.5 flex-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive(l.href)
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Link
            href="/entries/new"
            className="hidden sm:inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New Entry
          </Link>

          {/* User menu */}
          <div className="relative hidden sm:block" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="User menu"
            >
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:block text-sm text-gray-700 font-medium max-w-[100px] truncate">{user?.name}</span>
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50 overflow-hidden" role="menu">
                <div className="px-3.5 py-2.5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                  <span className={`mt-1 inline-block text-xs font-medium rounded-full px-2 py-0.5 ${
                    user?.role === 'admin' ? 'bg-red-50 text-red-600' :
                    user?.role === 'curator' ? 'bg-violet-50 text-violet-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>{user?.role}</span>
                </div>
                <div className="py-1">
                  <Link href="/account/change-password" onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors" role="menuitem">
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="2" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Change password
                  </Link>
                </div>
                <div className="border-t border-gray-100 py-1">
                  <button onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors" role="menuitem">
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle navigation"
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/entries/new"
            className="block px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            + New Entry
          </Link>
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="px-3 py-1.5 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-semibold text-xs">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <Link href="/account/change-password" className="block px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              Change password
            </Link>
            <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
