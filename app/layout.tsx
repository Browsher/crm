import type { Metadata } from 'next'
import { TemaCrmProvider } from '@/src/components/crm/tema'
import './globals.css'

export const metadata: Metadata = {
  title: 'CRM',
  description: 'CRM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><TemaCrmProvider>{children}</TemaCrmProvider></body>
    </html>
  )
}
