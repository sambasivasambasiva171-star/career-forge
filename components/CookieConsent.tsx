'use client'

import { useState, useEffect } from 'react'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('cookie-consent-dismissed')
    if (!dismissed) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem('cookie-consent-dismissed', 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white px-4 py-3 z-50">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <p>
          We use essential cookies to keep you signed in. By using Career Forge, you agree
          to our use of these cookies. See our{' '}
          <a href="/cookies" className="underline">Cookie Policy</a>.
        </p>
        <button
          onClick={dismiss}
          className="bg-white text-gray-900 rounded px-4 py-1.5 text-sm font-medium shrink-0"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
