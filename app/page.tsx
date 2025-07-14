// app/page.tsx
// Focused dashboard for Monday.com priority workspace visualization

'use client'

import { useState, useEffect } from 'react'
import MermaidDiagram from '@/components/MermaidDiagram'
import type { OrganizationalStructure, ApiState } from '@/lib/types'

// Simple StatCard component (inline)
function StatCard({ title, value, icon, description }: {
  title: string
  value: number
  icon: string
  description: string
}) {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      textAlign: 'center',
      minWidth: '200px'
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.25rem', color: '#1f2937' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#374151' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
        {description}
      </div>
    </div>
  )
}

// Priority Workspace Info Component
function PriorityWorkspaceInfo({ orgData }: { orgData: OrganizationalStructure | null }) {
  if (!orgData) return null

  const priorityWorkspaceNames = ['CRM', 'Production 2025', 'Lab', 'VRM - Purchasing']
  const priorityWorkspaces = orgData.workspaces.filter(w => 
    priorityWorkspaceNames.includes(w.name)
  )

  return (
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      marginBottom: '2rem'
    }}>
      <h3 style={{ 
        margin: '0 0 1rem 0', 
        fontSize: '1.125rem', 
        fontWeight: '600',
        color: '#1f2937'
      }}>
        🎯 Priority Workspaces
      </h3>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        {priorityWorkspaces.map(workspace => {
          const workspaceBoards = orgData.boards.filter(board => 
            board.workspace?.id === workspace.id && board.state === 'active'
          )
          const totalItems = workspaceBoards.reduce((sum, board) => 
            sum + (board.items_count || 0), 0
          )
          
          return (
            <div 
              key={workspace.id}
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.375rem',
                padding: '1rem',
              }}
            >
              <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#1e293b' }}>
                🏢 {workspace.name}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                {workspaceBoards.length} active boards
              </div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                {totalItems.toLocaleString()} total items
              </div>
            </div>
          )
        })}
      </div>
      
      {priorityWorkspaces.length < priorityWorkspaceNames.length && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          color: '#92400e'
        }}>
          ⚠️ Some priority workspaces not found. Check workspace names in your Monday.com account.
        </div>
      )}
    </div>
  )
}

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

  // Discover priority workspaces only
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
          Priority Workspace Intelligence
        </h1>
        <p style={{ 
          fontSize: '1.125rem', 
          color: '#64748b',
          marginBottom: '2rem'
        }}>
          Focused visualization and analytics for your core Monday.com workspaces:
          <strong> CRM, Production 2025, Lab, and VRM - Purchasing</strong>
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
            {orgData.status === 'loading' ? '🔄 Syncing...' : '🎯 Sync Priority Workspaces'}
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
            📊 Workspace Overview
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
            🕸️ Board Connections
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
            🏥 Health Analysis
          </button>
        </div>
      </section>

      {/* Priority Workspace Info */}
      <PriorityWorkspaceInfo orgData={orgData.data} />

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
              Make sure your MONDAY_API_KEY is set correctly and that your priority workspace names match exactly.
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
          Priority Workspace Metrics
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.5rem'
        }}>
          <StatCard 
            title="Priority Workspaces" 
            value={stats.workspaces}
            icon="🎯"
            description="Core workspaces"
          />
          <StatCard 
            title="Active Boards" 
            value={stats.activeBoards}
            icon="📋"
            description="In priority workspaces"
          />
          <StatCard 
            title="Total Items" 
            value={stats.totalItems}
            icon="📝"
            description="Across all boards"
          />
          <StatCard 
            title="Health Score" 
            value={orgData.data ? Math.round((stats.activeBoards / stats.boards) * 100) : 0}
            icon="💪"
            description="% active boards"
          />
        </div>
        
        <div style={{ 
          textAlign: 'center', 
          marginTop: '1rem', 
          fontSize: '0.875rem', 
          color: '#64748b' 
        }}>
          Last synced: {stats.lastScan}
        </div>
      </section>

      {/* Board Selection (for connections view) */}
      {diagramType === 'connections' && orgData.data && (
        <section style={{ marginBottom: '2rem' }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '1.5rem'
          }}>
            <label 
              htmlFor="board-selector"
              style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '500',
                color: '#374151'
              }}
            >
              Select a board to explore its connections:
            </label>
            <select
              id="board-selector"
              name="board-selector"
              value={selectedBoard || ''}
              onChange={(e) => setSelectedBoard(e.target.value || null)}
              style={{
                width: '100%',
                maxWidth: '500px',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff'
              }}
            >
              <option value="">Choose a board from your priority workspaces...</option>
              {orgData.data.boards
                .filter(board => board.state === 'active')
                .map(board => (
                  <option key={board.id} value={board.id}>
                    {board.name} ({board.workspace?.name}) - {board.items_count || 0} items
                  </option>
                ))}
            </select>
          </div>
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
          {diagramType === 'organization' && 'Priority Workspace Structure'}
          {diagramType === 'connections' && 'Board Connection Analysis'}
          {diagramType === 'health' && 'Workspace Health Dashboard'}
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
              Ready for Focused Monday.com Analysis
            </h3>
            <p style={{ color: '#64748b', textAlign: 'center', maxWidth: '500px' }}>
              Click "Sync Priority Workspaces" to connect to your Monday.com account and visualize 
              your core CRM, Production, Lab, and Purchasing operations with intelligent diagrams.
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
              Syncing Priority Workspaces...
            </h3>
            <p style={{ color: '#64748b', textAlign: 'center' }}>
              Fetching boards and relationships from your core Monday.com workspaces...
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
              {diagramType === 'connections' ? 'Select a Board' : 'Preparing Diagram'}
            </h3>
            <p style={{ color: '#64748b', textAlign: 'center' }}>
              {diagramType === 'connections' 
                ? 'Choose a board from the dropdown above to explore its connections.'
                : 'Generating your priority workspace visualization...'}
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
              Generating Intelligent Diagram...
            </h3>
            <p style={{ color: '#64748b', textAlign: 'center' }}>
              Creating actionable visualization with board health, relationships, and activity insights...
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

      {/* Tips Section */}
      {orgData.data && (
        <section style={{ marginTop: '3rem' }}>
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '0.5rem',
            padding: '1.5rem'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#0c4a6e' }}>
              💡 Pro Tips
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#075985', fontSize: '0.875rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Workspace Overview:</strong> See all boards with health indicators and item counts
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Board Connections:</strong> Explore how boards connect through mirror columns and connect boards
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Health Analysis:</strong> Identify inactive boards and optimization opportunities
              </li>
              <li>
                Health indicators: ✅ Healthy • ⚠️ Needs attention • 😴 Inactive
              </li>
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
