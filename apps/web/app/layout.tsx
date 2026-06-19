import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

const description = 'Find the traders who spotted the move early.'
const ogImage = '/og-image.png'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.calledit.site'),
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
    images: [
      {
        url: ogImage,
        width: 1731,
        height: 909,
        alt: 'Called It - Find the traders who spotted the move early.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Called It',
    description,
    images: [ogImage],
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
