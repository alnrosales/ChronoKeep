import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ChronoKeep — Workforce Time & Attendance.',
  description: 'Track employee attendance, work hours, shifts, and time records in one simple, reliable platform.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">{children}</body>
    </html>
  )
}
