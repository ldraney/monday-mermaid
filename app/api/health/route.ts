 v// app/api/health/route.ts
// API endpoint for organizational health analysis

import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationalStructure } from '@/lib/database'
import { healthAnalyzer } from '@/lib/health-analyzer'

export async function GET(request: NextRequest) {
  try {
    // Get organizational data from cache
    const orgData = await getOrganizationalStructure()
    
    if (!orgData || orgData.boards.length === 0) {
      return NextResponse.json(
        { error: 'No organizational data found. Please sync data first.' },
        { status: 404 }
      )
    }

    // Perform comprehensive health analysis
    const healthMetrics = healthAnalyzer.analyzeOrganizationHealth(orgData)
    const recommendations = healthAnalyzer.generateHealthRecommendations(orgData)
    const visualizationData = healthAnalyzer.getHealthMetricsForVisualization(orgData)
    
    // Analyze individual boards
    const boardHealthDetails = orgData.boards
      .map(board => healthAnalyzer.analyzeBoardHealth(board))
      .sort((a, b) => {
        // Sort by status priority: abandoned > inactive > warning > healthy
        const statusPriority = { abandoned: 4, inactive: 3, warning: 2, healthy: 1 }
        return statusPriority[b.status] - statusPriority[a.status]
      })

    // Analyze workspaces
    const workspaceHealthDetails = orgData.workspaces
      .map(workspace => healthAnalyzer.analyzeWorkspaceHealth(workspace, orgData.boards))
      .sort((a, b) => a.overallScore - b.overallScore) // Worst first

    // Calculate key insights
    const insights = generateHealthInsights(orgData, healthMetrics, boardHealthDetails)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      
      // Summary metrics
      overallScore: visualizationData.overallScore,
      summary: {
        totalBoards: healthMetrics.totalBoards,
        activeBoards: healthMetrics.activeBoards,
        inactiveBoards: healthMetrics.inactiveBoards.length,
        underutilizedBoards: healthMetrics.underutilizedBoards.length,
        archivedBoards: healthMetrics.archivedBoards,
        totalItems: healthMetrics.totalItems,
      },

      // Detailed analysis
      boardHealth: {
        statusCounts: visualizationData.boardStatusCounts,
        details: boardHealthDetails.slice(0, 20), // Limit for performance
        problematicBoards: {
          inactive: healthMetrics.inactiveBoards.map(board => ({
            id: board.id,
            name: board.name,
            workspace: board.workspace?.name,
            lastActivity: board.updated_at,
            itemCount: board.items_count || 0
          })),
          underutilized: healthMetrics.underutilizedBoards.map(board => ({
            id: board.id,
            name: board.name,
            workspace: board.workspace?.name,
            itemCount: board.items_count || 0
          }))
        }
      },

      // Workspace analysis
      workspaceHealth: {
        scores: visualizationData.workspaceScores,
        details: workspaceHealthDetails
      },

      // Activity trends
      activity: {
        trends: visualizationData.trends,
        summary: healthMetrics.activitySummary
      },

      // Recommendations and insights
      recommendations,
      insights,

      // Metadata
      analysis: {
        analyzedAt: new Date().toISOString(),
        dataAge: orgData.lastScanned,
        boardsAnalyzed: orgData.boards.length,
        workspacesAnalyzed: orgData.workspaces.length
      }
    })

  } catch (error) {
    console.error('❌ Health analysis API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Health analysis failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, boardIds, workspaceIds } = body

    // Handle specific health actions
    switch (action) {
      case 'analyze_boards':
        if (!boardIds || !Array.isArray(boardIds)) {
          return NextResponse.json(
            { error: 'Board IDs array required for board analysis' },
            { status: 400 }
          )
        }
        
        const orgData = await getOrganizationalStructure()
        const targetBoards = orgData.boards.filter(board => boardIds.includes(board.id))
        const boardAnalysis = targetBoards.map(board => healthAnalyzer.analyzeBoardHealth(board))
        
        return NextResponse.json({
          success: true,
          boardAnalysis,
          summary: {
            total: boardAnalysis.length,
            healthy: boardAnalysis.filter(b => b.status === 'healthy').length,
            warning: boardAnalysis.filter(b => b.status === 'warning').length,
            inactive: boardAnalysis.filter(b => b.status === 'inactive').length,
            abandoned: boardAnalysis.filter(b => b.status === 'abandoned').length,
          }
        })

      case 'analyze_workspaces':
        if (!workspaceIds || !Array.isArray(workspaceIds)) {
          return NextResponse.json(
            { error: 'Workspace IDs array required for workspace analysis' },
            { status: 400 }
          )
        }
        
        const orgDataWs = await getOrganizationalStructure()
        const targetWorkspaces = orgDataWs.workspaces.filter(ws => workspaceIds.includes(ws.id))
        const workspaceAnalysis = targetWorkspaces.map(workspace => 
          healthAnalyzer.analyzeWorkspaceHealth(workspace, orgDataWs.boards)
        )
        
        return NextResponse.json({
          success: true,
          workspaceAnalysis,
          summary: {
            total: workspaceAnalysis.length,
            averageScore: workspaceAnalysis.reduce((sum, ws) => sum + ws.overallScore, 0) / workspaceAnalysis.length,
            highPerforming: workspaceAnalysis.filter(ws => ws.overallScore > 80).length,
            needsAttention: workspaceAnalysis.filter(ws => ws.overallScore < 50).length,
          }
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Health action API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Health action failed',
      },
      { status: 500 }
    )
  }
}

// Helper function to generate key insights
function generateHealthInsights(orgData: any, healthMetrics: any, boardHealthDetails: any[]): string[] {
  const insights: string[] = []

  // Overall health insight
  const healthyRatio = healthMetrics.activeBoards / healthMetrics.totalBoards
  if (healthyRatio > 0.8) {
    insights.push('🎯 Your organization has excellent board health with most boards actively used')
  } else if (healthyRatio > 0.6) {
    insights.push('👍 Good organization health with room for optimization')
  } else {
    insights.push('⚠️ Organization health needs attention - many boards are inactive')
  }

  // Activity insight
  const weeklyActiveRatio = healthMetrics.activitySummary.weekly / healthMetrics.activeBoards
  if (weeklyActiveRatio < 0.3) {
    insights.push('📊 Low weekly activity detected - boards may need more engagement')
  }

  // Workspace distribution insight
  const avgBoardsPerWorkspace = healthMetrics.totalBoards / orgData.workspaces.length
  if (avgBoardsPerWorkspace > 20) {
    insights.push('🏢 Workspaces have many boards - consider organizational structure review')
  } else if (avgBoardsPerWorkspace < 3) {
    insights.push('🔄 Few boards per workspace - consider workspace consolidation')
  }

  // Item density insight
  const avgItemsPerBoard = healthMetrics.totalItems / healthMetrics.totalBoards
  if (avgItemsPerBoard < 5) {
    insights.push('📝 Low item density across boards - many boards may be underutilized')
  } else if (avgItemsPerBoard > 50) {
    insights.push('📈 High item density - boards are well-utilized')
  }

  // Archive opportunity insight
  if (healthMetrics.inactiveBoards.length > healthMetrics.totalBoards * 0.2) {
    insights.push(`🗂️ ${healthMetrics.inactiveBoards.length} boards could be archived to improve organization`)
  }

  return insights
}
