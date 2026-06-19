import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

const description = 'Find traders who called public ticker moves early.'

export const metadata: Metadata = {
  title: 'Called It',
  applicationName: 'Called It',
  description,
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'Called It',
    description,
    siteName: 'Called It',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Called It',
    description,
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <footer className="site-footer">
          Built by <a href="https://x.com/Mysterious35725" target="_blank" rel="noreferrer">Mysterious35725</a>
        </footer>
      </body>
    </html>
  )
}
