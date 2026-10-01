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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <header className="taskbar">
          <a className="brand" href="/">Called It<span>.</span></a>
          <a className="taskbar-item" href="/">Leaderboard</a>
        </header>
        {children}
      </body>
    </html>
  )
}
