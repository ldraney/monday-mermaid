// app/page.tsx
// Main dashboard for Monday.com organizational visualization

'use client'

import type { DashboardState } from '@/lib/types'

export default function HomePage() {
  // This will eventually be populated from Monday.com API
  const mockStats = {
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
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            onClick={() => alert('Monday.com API integration coming next!')}
          >
            🔍 Discover Organization
          </button>
          
          <button
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
            onClick={() => alert('Show Connections feature coming soon!')}
          >
            🕸️ Show Connections
          </button>

          <button
            style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f59e0b'}
            onClick={() => alert('Health Analysis coming soon!')}
          >
            🏥 Health Check
          </button>
        </div>
      </section>

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
            value={mockStats.workspaces}
            icon="🏢"
            description="Total workspaces"
          />
          <StatCard 
            title="Boards" 
            value={mockStats.boards}
            icon="📋"
            description="Total boards"
          />
          <StatCard 
            title="Active Boards" 
            value={mockStats.activeBoards}
            icon="✅"
            description="Currently active"
          />
          <StatCard 
            title="Total Items" 
            value={mockStats.totalItems}
            icon="📝"
            description="Across all boards"
          />
        </div>
      </section>

      {/* Preview Area */}
      <section>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          marginBottom: '1.5rem',
          color: '#1e293b'
        }}>
          Organizational Diagram Preview
        </h2>
        
        <div style={{
          backgroundColor: '#ffffff',
          border: '2px dashed #e2e8f0',
          borderRadius: '0.75rem',
          padding: '3rem',
          textAlign: 'center',
          minHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
            🎯
          </div>
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            marginBottom: '0.5rem',
            color: '#1e293b'
          }}>
            Ready for Monday.com Integration
          </h3>
          <p style={{ 
            color: '#64748b',
            marginBottom: '1.5rem',
            maxWidth: '500px'
          }}>
            Connect your Monday.com account to see beautiful Mermaid diagrams of your 
            organizational structure, board relationships, and health analytics.
          </p>
          <div style={{
            backgroundColor: '#f1f5f9',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: '#475569'
          }}>
            Next: Add Monday.com API integration and PostgreSQL caching
          </div>
        </div>
      </section>
    </div>
  )
}

// Reusable StatCard component
function StatCard({ 
  title, 
  value, 
  icon, 
  description 
}: { 
  title: string
  value: number | string
  icon: string
  description: string
}) {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      padding: '1.5rem',
      borderRadius: '0.75rem',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '0.75rem' 
      }}>
        <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>
          {icon}
        </span>
        <h3 style={{ 
          fontSize: '0.875rem', 
          fontWeight: '500', 
          color: '#64748b',
          margin: 0
        }}>
          {title}
        </h3>
      </div>
      
      <div style={{ 
        fontSize: '2rem', 
        fontWeight: '700', 
        color: '#1e293b',
        marginBottom: '0.25rem'
      }}>
        {value}
      </div>
      
      <p style={{ 
        fontSize: '0.75rem', 
        color: '#94a3b8',
        margin: 0
      }}>
        {description}
      </p>
    </div>
  )
}
