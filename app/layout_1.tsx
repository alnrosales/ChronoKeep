import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ChronoKeep - Production Timekeeper',
  description: 'Tamper-proof timekeeping for remote & onsite teams',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">{children}</body>
    </html>
  )
}
