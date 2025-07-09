import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FILE-CONTENT-TRACKER',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className="bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
        style={{
          fontFamily: 'Inter, sans-serif',
          lineHeight: '1.5',
          margin: '0',
          padding: '0',
        }}
      >
        {children}
      </body>
    </html>
  )
}
