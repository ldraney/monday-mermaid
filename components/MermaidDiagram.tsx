// components/MermaidDiagram.tsx
// Interactive Mermaid diagram renderer with click handlers and zoom

'use client'

import { useEffect, useRef, useState } from 'react'

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
  const diagramRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diagramId] = useState(() => `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    if (!diagram || !diagramRef.current) return

    const renderDiagram = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Wait for Mermaid to be available
        let attempts = 0
        while (!window.mermaid && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++
        }

        if (!window.mermaid) {
          throw new Error('Mermaid library not loaded')
        }

        // Clear previous diagram
        if (diagramRef.current) {
          diagramRef.current.innerHTML = ''
        }

        // Configure Mermaid
        window.mermaid.initialize({ 
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 14,
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
          },
          themeVariables: {
            primaryColor: '#3b82f6',
            primaryTextColor: '#ffffff',
            primaryBorderColor: '#2563eb',
            lineColor: '#6b7280',
            background: '#ffffff',
            mainBkg: '#f8fafc',
            secondBkg: '#e2e8f0'
          }
        })

        // Render the diagram
        const { svg, bindFunctions } = await window.mermaid.render(diagramId, diagram)
        
        if (diagramRef.current) {
          diagramRef.current.innerHTML = svg
          
          // Bind click handlers if provided
          if (onNodeClick && bindFunctions) {
            bindFunctions(diagramRef.current)
          }

          // Add custom click handlers to nodes
          if (onNodeClick) {
            const nodes = diagramRef.current.querySelectorAll('.node')
            nodes.forEach((node, index) => {
              node.addEventListener('click', (e) => {
                e.preventDefault()
                const nodeId = node.getAttribute('id') || `node-${index}`
                onNodeClick(nodeId, { element: node })
              })
              
              // Add hover effects
              node.addEventListener('mouseenter', () => {
                (node as HTMLElement).style.cursor = 'pointer'
                ;(node as HTMLElement).style.opacity = '0.8'
              })
              
              node.addEventListener('mouseleave', () => {
                ;(node as HTMLElement).style.opacity = '1'
              })
            })
          }

          // Make diagram responsive
          const svgElement = diagramRef.current.querySelector('svg')
          if (svgElement) {
            svgElement.style.maxWidth = '100%'
            svgElement.style.height = 'auto'
          }
        }

        setIsLoading(false)
      } catch (err) {
        console.error('Mermaid rendering error:', err)
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
        setIsLoading(false)
      }
    }

    renderDiagram()
  }, [diagram, diagramId, onNodeClick])

  const handleZoomIn = () => {
    const svgElement = diagramRef.current?.querySelector('svg')
    if (svgElement) {
      const currentScale = svgElement.style.transform.match(/scale\(([^)]+)\)/)?.[1] || '1'
      const newScale = Math.min(parseFloat(currentScale) * 1.2, 3)
      svgElement.style.transform = `scale(${newScale})`
    }
  }

  const handleZoomOut = () => {
    const svgElement = diagramRef.current?.querySelector('svg')
    if (svgElement) {
      const currentScale = svgElement.style.transform.match(/scale\(([^)]+)\)/)?.[1] || '1'
      const newScale = Math.max(parseFloat(currentScale) / 1.2, 0.3)
      svgElement.style.transform = `scale(${newScale})`
    }
  }

  const handleResetZoom = () => {
    const svgElement = diagramRef.current?.querySelector('svg')
    if (svgElement) {
      svgElement.style.transform = 'scale(1)'
    }
  }

  const handleFullscreen = () => {
    if (diagramRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        diagramRef.current.requestFullscreen()
      }
    }
  }

  return (
    <div 
      className={`mermaid-diagram-container ${className}`}
      style={{
        position: 'relative',
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
          <h3 style={{ 
            margin: 0, 
            fontSize: '1rem', 
            fontWeight: '600',
            color: '#1f2937'
          }}>
            {title}
          </h3>
          
          {/* Controls */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleZoomIn}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                cursor: 'pointer'
              }}
              title="Zoom In"
            >
              🔍+
            </button>
            <button
              onClick={handleZoomOut}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                cursor: 'pointer'
              }}
              title="Zoom Out"
            >
              🔍-
            </button>
            <button
              onClick={handleResetZoom}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                cursor: 'pointer'
              }}
              title="Reset Zoom"
            >
              ↻
            </button>
            <button
              onClick={handleFullscreen}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                cursor: 'pointer'
              }}
              title="Fullscreen"
            >
              ⛶
            </button>
          </div>
        </div>
      )}

      {/* Diagram Content */}
      <div style={{
        padding: '1rem',
        minHeight: '300px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'auto'
      }}>
        {isLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔄</div>
            <div>Rendering diagram...</div>
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: '#dc2626'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</div>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              Diagram Error
            </div>
            <div style={{ fontSize: '0.875rem', textAlign: 'center' }}>
              {error}
            </div>
          </div>
        )}

        {!isLoading && !error && (
          <div 
            ref={diagramRef}
            style={{
              width: '100%',
              textAlign: 'center',
              transition: 'transform 0.2s ease-in-out'
            }}
          />
        )}
      </div>

      {/* Footer Info */}
      {!isLoading && !error && (
        <div style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e5e7eb',
          fontSize: '0.75rem',
          color: '#6b7280',
          textAlign: 'center'
        }}>
          {onNodeClick && 'Click nodes to explore • '}
          Use controls to zoom and navigate
        </div>
      )}
    </div>
  )
}
