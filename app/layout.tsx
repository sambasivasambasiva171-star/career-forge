import type { Metadata } from 'next'
import './globals.css'
import CookieConsent from '@/components/CookieConsent'

export const metadata: Metadata = {
  title: 'Career Forge',
  description: 'AI-powered ATS resume builder with intelligent skill discovery',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  )
}
