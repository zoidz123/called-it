import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getSiteUrl } from '../lib/site'

const description = 'Find the traders who spotted the move early.'
const ogImage = '/og-image.png?v=052886a'

export function generateMetadata(): Metadata {
  return {
    metadataBase: getSiteUrl(),
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
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  )
}
