// app/api/diagram/route.ts
// API endpoint for generating Mermaid diagrams

import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationalStructure } from '@/lib/database'
import { 
  generateOrgChart, 
  generateBoardConnections, 
  generateWorkspaceView, 
  generateHealthView 
} from '@/lib/mermaid-generator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, boardId, workspaceId, options = {} } = body

    // Get organizational data from cache
    const orgData = await getOrganizationalStructure()
    
    if (!orgData || orgData.boards.length === 0) {
      return NextResponse.json(
        { error: 'No organizational data found. Please sync data first.' },
        { status: 404 }
      )
    }

    let diagram: string
    let title: string

    switch (type) {
      case 'organization':
        diagram = generateOrgChart(orgData, options)
        title = 'Organization Structure'
        break

      case 'connections':
        if (!boardId) {
          return NextResponse.json(
            { error: 'Board ID required for connections diagram' },
            { status: 400 }
          )
        }
        
        const board = orgData.boards.find(b => b.id === boardId)
        if (!board) {
          return NextResponse.json(
            { error: `Board ${boardId} not found` },
            { status: 404 }
          )
        }
        
        diagram = generateBoardConnections(boardId, orgData)
        title = `Connections for ${board.name}`
        break

      case 'workspace':
        if (!workspaceId) {
          return NextResponse.json(
            { error: 'Workspace ID required for workspace diagram' },
            { status: 400 }
          )
        }
        
        const workspace = orgData.workspaces.find(w => w.id === workspaceId)
        if (!workspace) {
          return NextResponse.json(
            { error: `Workspace ${workspaceId} not found` },
            { status: 404 }
          )
        }
        
        diagram = generateWorkspaceView(workspaceId, orgData)
        title = `${workspace.name} Workspace`
        break

      case 'health':
        diagram = generateHealthView(orgData)
        title = 'Organization Health Dashboard'
        break

      default:
        return NextResponse.json(
          { error: `Unknown diagram type: ${type}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      type,
      title,
      diagram,
      generated_at: new Date().toISOString(),
      stats: {
        nodes: (diagram.match(/\[.*?\]/g) || []).length,
        edges: (diagram.match(/-->/g) || []).length + (diagram.match(/\.-\./g) || []).length,
        workspaces: orgData.healthMetrics.totalWorkspaces,
        boards: orgData.healthMetrics.totalBoards,
      }
    })

  } catch (error) {
    console.error('❌ Diagram API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Diagram generation failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get available diagram types and organization summary
    const orgData = await getOrganizationalStructure()
    
    const availableTypes = ['organization', 'health']
    
    // Add connections type if there are boards
    if (orgData.boards.length > 0) {
      availableTypes.push('connections')
    }
    
    // Add workspace type if there are multiple workspaces
    if (orgData.workspaces.length > 1) {
      availableTypes.push('workspace')
    }

    return NextResponse.json({
      success: true,
      availableTypes,
      summary: {
        workspaces: orgData.workspaces.map(w => ({
          id: w.id,
          name: w.name,
          boardCount: orgData.boards.filter(b => b.workspace?.id === w.id).length
        })),
        boards: orgData.boards
          .filter(b => b.state === 'active')
          .slice(0, 20) // Limit for performance
          .map(b => ({
            id: b.id,
            name: b.name,
            workspace: b.workspace?.name || 'Unknown',
            itemCount: b.items_count || 0
          })),
        totalBoards: orgData.healthMetrics.totalBoards,
        activeBoards: orgData.healthMetrics.activeBoards,
      }
    })

  } catch (error) {
    console.error('❌ Diagram info API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get diagram info',
      },
      { status: 500 }
    )
  }
}
