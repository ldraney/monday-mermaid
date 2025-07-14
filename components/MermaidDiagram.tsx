// components/MermaidDiagram.tsx
// SIMPLE, BULLETPROOF VERSION

'use client'

import { useEffect, useState } from 'react'

interface MermaidDiagramProps {
  diagram: string
  title?: string
  onNodeClick?: (nodeId: string, nodeData?: any) => void
  className?: string
  style?: React.CSSProperties
}

declare global {
  interface Window {
    mermaid: any
  }
}

export default function MermaidDiagram({ 
  diagram, 
  title,
  onNodeClick,
  className = '',
  style = {}
}: MermaidDiagramProps) {
  const [status, setStatus] = useState<string>('Starting...')
  const [svgContent, setSvgContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [diagramId] = useState(() => `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    let mounted = true

    const renderDiagram = async () => {
      try {
        setStatus('Starting render...')
        setError(null)
        setSvgContent('')

        if (!diagram) {
          setStatus('❌ No diagram content')
          return
        }

        setStatus(`📊 Got diagram (${diagram.length} chars)`)

        // Wait for Mermaid
        let attempts = 0
        while (!window.mermaid && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++
          setStatus(`Waiting for Mermaid... ${attempts}/50`)
        }

        if (!window.mermaid) {
          throw new Error('Mermaid library not loaded')
        }

        setStatus('✅ Mermaid loaded, initializing...')

        // Initialize Mermaid
        window.mermaid.initialize({ 
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          htmlLabels: false
        })

        setStatus('🔄 Rendering diagram...')

        // Log diagram for debugging
        console.log('📊 Rendering diagram:', diagram.substring(0, 100) + '...')

        // Render the diagram
        const result = await window.mermaid.render(diagramId, diagram)
        
        if (mounted && result.svg) {
          setStatus('✅ Diagram rendered successfully!')
          setSvgContent(result.svg)
        }

      } catch (err) {
        console.error('❌ Mermaid error:', err)
        console.log('📊 Failed diagram:', diagram)
        
        const errorMsg = err instanceof Error ? err.message : 'Render failed'
        setError(errorMsg)
        setStatus(`❌ Error: ${errorMsg}`)
      }
    }

    const timer = setTimeout(renderDiagram, 100)
    
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [diagram, diagramId])

  return (
    <div 
      className={`mermaid-diagram-container ${className}`}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        ...style
      }}
    >
      {/* Header */}
      {title && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
            {title}
          </h3>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {status}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{
        padding: '1rem',
        minHeight: '300px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {/* Show status while loading */}
        {!svgContent && !error && (
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔄</div>
            <div>{status}</div>
          </div>
        )}

        {/* Show error */}
        {error && (
          <div style={{ textAlign: 'center', color: '#dc2626' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</div>
            <div style={{ fontWeight: '600' }}>Diagram Error</div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</div>
            
            {/* Debug info */}
            <details style={{ marginTop: '1rem', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.875rem' }}>Debug Info</summary>
              <pre style={{ 
                fontSize: '0.75rem', 
                backgroundColor: '#f5f5f5', 
                padding: '0.5rem', 
                marginTop: '0.5rem',
                maxHeight: '200px',
                overflow: 'auto',
                textAlign: 'left'
              }}>
                {diagram.substring(0, 500)}...
              </pre>
            </details>
          </div>
        )}

        {/* Show rendered diagram */}
        {svgContent && (
          <div 
            style={{ width: '100%', textAlign: 'center' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 1rem',
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e5e7eb',
        fontSize: '0.75rem',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        Status: {status}
      </div>
    </div>
  )
}
