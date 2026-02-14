import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lux Network - Sign In',
  description: 'Sign in to Lux Network',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center px-4">
          {children}
        </main>
        <footer className="py-6 text-center text-sm text-neutral-500">
          Lux Network
        </footer>
      </body>
    </html>
  )
}
