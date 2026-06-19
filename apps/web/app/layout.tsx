import './globals.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Called It Market Board',
  description: 'Measure what happens after public X ticker mentions.',
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
