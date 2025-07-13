import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Monday Mermaid',
  description: 'Monday.com organizational visualization with Mermaid.js diagrams and PostgreSQL caching',
  keywords: ['monday.com', 'mermaid', 'organizational-chart', 'visualization'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Mermaid.js from CDN - no package dependency! */}
        <script 
          src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
          defer
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.addEventListener('load', () => {
                  if (window.mermaid) {
                    window.mermaid.initialize({ 
                      startOnLoad: false,
                      theme: 'default',
                      securityLevel: 'loose'
                    });
                  }
                });
              }
            `
          }}
        />
      </head>
      <body style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        margin: 0,
        padding: 0,
        backgroundColor: '#f8fafc',
        color: '#1e293b'
      }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <header style={{
            backgroundColor: '#1e293b',
            color: '#ffffff',
            padding: '1rem 2rem',
            borderBottom: '1px solid #334155'
          }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
              🎯 Monday Mermaid
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.8 }}>
              Monday.com organizational visualization & intelligence
            </p>
          </header>

          {/* Main content */}
          <main style={{
            flex: 1,
            padding: '2rem'
          }}>
            {children}
          </main>

          {/* Footer */}
          <footer style={{
            padding: '1rem 2rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            fontSize: '0.875rem',
            color: '#64748b',
            textAlign: 'center'
          }}>
            Built with Next.js 15 + PostgreSQL + Mermaid.js
          </footer>
        </div>
      </body>
    </html>
  )
}
