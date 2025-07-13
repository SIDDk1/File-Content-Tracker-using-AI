import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'File Content Tracker Using AI',
  description: 'Project 13',
  generator: 'TEAM 13',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
