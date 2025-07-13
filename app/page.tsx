// app/page.tsx
// Main dashboard for Monday.com organizational visualization

'use client'

import { useState, useEffect } from 'react'
import MermaidDiagram from '@/components/MermaidDiagram'
import type { OrganizationalStructure, ApiState } from '@/lib/types'

export default function HomePage() {
  const [orgData, setOrgData] = useState<ApiState<OrganizationalStructure>>({
    data: null,
    status: 'idle',
    error: null
  })
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null)
  const [diagramType, setDiagramType] = useState<'organization' | 'connections' | 'health'>('organization')
  const [currentDiagram, setCurrentDiagram] = useState<{
    diagram: string
    title: string
  } | null>(null)
  const [diagramLoading, setDiagramLoading] = useState(false)

  // Discover organization data
  const discoverOrganization = async () => {
    setOrgData(prev => ({ ...prev, status: 'loading', error: null }))
    
    try {
      const response = await fetch('/api/sync', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'smart' })
      })
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync data')
      }
      
      setOrgData({
        data: result.data,
        status: 'success',
        error: null,
        lastFetched: new Date()
      })
    } catch (error) {
      setOrgData(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }

  // Generate Mermaid diagram
  const generateDiagram = async () => {
    if (!orgData.data) return

    setDiagramLoading(true)
    
    try {
      let requestBody: any = { type: diagramType }
      
      if (diagramType === 'connections') {
        if (!selectedBoard) {
          setCurrentDiagram(null)
          setDiagramLoading(false)
          return
        }
        requestBody.boardId = selectedBoard
      } else if (diagramType === 'organization') {
        requestBody.options = { showInactive: false, colorByHealth: true }
      }

      const response = await fetch('/api/diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate diagram')
      }
      
      setCurrentDiagram({
        diagram: result.diagram,
        title: result.title
      })
    } catch (error) {
      console.error('Failed to generate diagram:', error)
      setCurrentDiagram(null)
    } finally {
      setDiagramLoading(false)
    }
  }

  // Auto-generate diagram when data or type changes
  useEffect(() => {
    if (orgData.data) {
      generateDiagram()
    }
  }, [orgData.data, diagramType, selectedBoard])

  // Handle node clicks in diagrams (enables "Show Connections" interactivity)
  const handleNodeClick = async (nodeId: string) => {
    if (!orgData.data) return
    
    // Extract board ID from mermaid node ID (format is usually n0, n1, etc.)
    // We need to find the actual board ID from the node click
    console.log('Node clicked:', nodeId)
    
    // For now, if we're not in connections mode, switch to it
    if (diagramType !== 'connections') {
      setDiagramType('connections')
    }
  }

  const stats = orgData.data ? {
    workspaces: orgData.data.healthMetrics.totalWorkspaces,
    boards: orgData.data.healthMetrics.totalBoards,
    activeBoards: orgData.data.healthMetrics.activeBoards,
    totalItems: orgData.data.healthMetrics.totalItems,
    lastScan: new Date(orgData.data.lastScanned).toLocaleString()
  } : {
    workspaces: 0,
    boards: 0,
    activeBoards: 0,
    totalItems: 0,
    lastScan: 'Not scanned yet'
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Hero Section */}
      <section style={{ marginBottom: '3rem' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: '700', 
          marginBottom: '1rem',
          color: '#1e293b'
        }}>
          Monday.com Organization Intelligence
        </h1>
        <p style={{ 
          fontSize: '1.125rem', 
          color: '#64748b',
          marginBottom: '2rem'
        }}>
          Visualize your Monday.com organizational structure with interactive Mermaid diagrams, 
          health analytics, and intelligent insights.
        </p>

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          flexWrap: 'wrap' 
        }}>
          <button
            style={{
              backgroundColor: orgData.status === 'loading' ? '#9ca3af' : '#3b82f6',
              color: 'white',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: orgData.status === 'loading' ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            disabled={orgData.status === 'loading'}
            onClick={discoverOrganization}
          >
            {orgData.status === 'loading' ? '🔄 Discovering...' : '🔍 Discover Organization'}
          </button>
          
          <button
            style={{
              backgroundColor: diagramType === 'connections' ? '#059669' : '#10b981',
              color: 'white',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: orgData.data ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s',
              opacity: orgData.data ? 1 : 0.5
            }}
            disabled={!orgData.data}
            onClick={() => setDiagramType('connections')}
          >
            🕸️ Show Connections
          </button>

          <button
            style={{
              backgroundColor: diagramType === 'health' ? '#d97706' : '#f59e0b',
              color: 'white',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: orgData.data ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s',
              opacity: orgData.data ? 1 : 0.5
            }}
            disabled={!orgData.data}
            onClick={() => setDiagramType('health')}
          >
            🏥 Health Check
          </button>

          <button
            style={{
              backgroundColor: diagramType === 'organization' ? '#7c3aed' : '#8b5cf6',
              color: 'white',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: orgData.data ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s',
              opacity: orgData.data ? 1 : 0.5
            }}
            disabled={!orgData.data}
            onClick={() => setDiagramType('organization')}
          >
            📊 Organization Chart
          </button>
        </div>
      </section>

      {/* Error Display */}
      {orgData.error && (
        <section style={{ marginBottom: '2rem' }}>
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '1rem',
            color: '#991b1b'
          }}>
            <strong>Error:</strong> {orgData.error}
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
              Make sure your MONDAY_API_KEY is set correctly in your environment variables.
            </div>
          </div>
        </section>
      )}

      {/* Stats Grid */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          marginBottom: '1.5rem',
          color: '#1e293b'
        }}>
          Organization Overview
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.5rem'
        }}>
          <StatCard 
            title="Workspaces" 
            value={stats.workspaces}
            icon="🏢"
            description="Total workspaces"
          />
          <StatCard 
            title="Boards" 
            value={stats.boards}
            icon="📋"
            description="Total boards"
          />
          <StatCard 
            title="Active Boards" 
            value={stats.activeBoards}
            icon="✅"
            description="Currently active"
          />
          <StatCard 
            title="Total Items" 
            value={stats.totalItems}
            icon="📝"
            description="Across all boards"
          />
        </div>
        
        <div style={{ 
          textAlign: 'center', 
          marginTop: '1rem', 
          fontSize: '0.875rem', 
          color: '#64748b' 
        }}>
          Last scanned: {stats.lastScan}
        </div>
      </section>

      {/* Board Selection (for connections view) */}
      {diagramType === 'connections' && orgData.data && (
        <section style={{ marginBottom: '2rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '500',
            color: '#374151'
          }}>
            Select board to show connections:
          </label>
          <select
            value={selectedBoard || ''}
            onChange={(e) => setSelectedBoard(e.target.value || null)}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            <option value="">Choose a board...</option>
            {orgData.data.boards
              .filter(board => board.state === 'active')
              .map(board => (
                <option key={board.id} value={board.id}>
                  {board.name} ({board.workspace?.name})
                </option>
              ))}
          </select>
        </section>
      )}

      {/* Interactive Diagram Display */}
      <section>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          marginBottom: '1.5rem',
          color: '#1e293b'
        }}>
          {diagramType === 'organization' && 'Organization Structure'}
          {diagramType === 'connections' && 'Board Connections'}
          {diagramType === 'health' && 'Health Dashboard'}
        </h2>
        
        {/* Diagram States */}
        {orgData.status === 'idle' && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '2px dashed #e2e8f0',
            borderRadius: '0.75rem',
            padding: '3rem',
            textAlign: 'center',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎯</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Ready for Monday.com Integration
            </h3>
            <p style={{ color: '#64748b', textAlign: 'center', maxWidth: '500px' }}>
              Click "Discover Organization" to connect to your Monday.com account and visualize 
              your organizational structure with interactive diagrams.
            </p>
          </div>
        )}
        
        {orgData.status === 'loading' && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.75rem',
            padding: '3rem',
            textAlign: 'center',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔄</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Discovering Organization...
            </h3>
            <p style={{ color: '#64748b', textAlign: 'center' }}>
              Fetching workspaces, boards, and relationships from Monday.com...
            </p>
          </div>
        )}
        
        {orgData.status === 'success' && !currentDiagram && !diagramLoading && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.75rem',
            padding: '3rem',
            textAlign: 'center',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📊</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Select a Board for Connections
            </h3>
            <p style={{ color: '#64748b', textAlign: 'center' }}>
              {diagramType === 'connections' 
                ? 'Choose a board from the dropdown above to see its connections.'
                : 'Preparing diagram...'}
            </p>
          </div>
        )}
        
        {diagramLoading && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.75rem',
            padding: '3rem',
            textAlign: 'center',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚡</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Generating Diagram...
            </h3>
            <p style={{ color: '#64748b', textAlign: 'center' }}>
              Creating your interactive organizational visualization...
            </p>
          </div>
        )}
        
        {orgData.status === 'success' && currentDiagram && !diagramLoading && (
          <MermaidDiagram
            diagram={currentDiagram.diagram}
            title={currentDiagram.title}
            onNodeClick={handleNodeClick}
            style={{ minHeight: '500px' }}
          />
        )}
      </section>
    </div>
  )
}
