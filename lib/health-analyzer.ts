// lib/health-analyzer.ts
// Organizational health analysis and metrics calculation

import { config } from './config'
import type { 
  OrganizationalStructure, 
  MondayBoard, 
  MondayWorkspace,
  BoardHealth, 
  WorkspaceHealth,
  HealthMetrics 
} from './types'

export class HealthAnalyzer {
  
  // =============================================================================
  // MAIN ANALYSIS METHODS
  // =============================================================================

  analyzeOrganizationHealth(orgData: OrganizationalStructure): HealthMetrics {
    const boardHealthScores = orgData.boards.map(board => this.analyzeBoardHealth(board))
    const workspaceHealthScores = orgData.workspaces.map(workspace => 
      this.analyzeWorkspaceHealth(workspace, orgData.boards)
    )

    // Identify problematic boards
    const inactiveBoards = boardHealthScores
      .filter(health => health.status === 'inactive' || health.status === 'abandoned')
      .map(health => health.board)

    const underutilizedBoards = boardHealthScores
      .filter(health => health.status === 'warning' && health.itemsCount < config.health.underutilizedItemsThreshold)
      .map(health => health.board)

    // Calculate activity summary
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const activitySummary = {
      daily: this.countRecentActivity(orgData.boards, oneDayAgo),
      weekly: this.countRecentActivity(orgData.boards, oneWeekAgo),
      monthly: this.countRecentActivity(orgData.boards, oneMonthAgo),
    }

    return {
      totalWorkspaces: orgData.workspaces.length,
      totalBoards: orgData.boards.length,
      activeBoards: orgData.boards.filter(board => board.state === 'active').length,
      archivedBoards: orgData.boards.filter(board => board.state === 'archived').length,
      totalItems: orgData.boards.reduce((sum, board) => sum + (board.items_count || 0), 0),
      inactiveBoards,
      underutilizedBoards,
      lastUpdated: new Date(),
      activitySummary,
    }
  }

  analyzeBoardHealth(board: MondayBoard): BoardHealth {
    const issues: string[] = []
    const recommendations: string[] = []
    
    // Calculate board age
    const createdAt = board.updated_at ? new Date(board.updated_at) : new Date()
    const boardAge = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24) // days
    
    // Skip analysis for very new boards
    if (boardAge < config.health.minBoardAgeForAnalysis) {
      return {
        board,
        status: 'healthy',
        itemsCount: board.items_count || 0,
        collaboratorsCount: 0, // Would need additional API calls to determine
        issues: ['Board too new for health analysis'],
        recommendations: ['Continue building out this board'],
      }
    }

    // Determine last activity
    const lastActivity = board.updated_at ? new Date(board.updated_at) : null
    const daysSinceActivity = lastActivity 
      ? (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity

    let status: BoardHealth['status'] = 'healthy'

    // Check for inactivity
    if (daysSinceActivity > config.health.inactiveDaysThreshold * 2) {
      status = 'abandoned'
      issues.push(`No activity for ${Math.round(daysSinceActivity)} days`)
      recommendations.push('Consider archiving or consolidating with active boards')
    } else if (daysSinceActivity > config.health.inactiveDaysThreshold) {
      status = 'inactive'
      issues.push(`No recent activity (${Math.round(daysSinceActivity)} days)`)
      recommendations.push('Review board usage and engage team members')
    }

    // Check item count
    const itemCount = board.items_count || 0
    if (itemCount === 0 && boardAge > 7) {
      if (status === 'healthy') status = 'warning'
      issues.push('No items in board')
      recommendations.push('Add initial items or consider if board is needed')
    } else if (itemCount < config.health.underutilizedItemsThreshold && boardAge > 14) {
      if (status === 'healthy') status = 'warning'
      issues.push('Very few items - possible underutilization')
      recommendations.push('Consider consolidating with other boards')
    }

    // Check board state
    if (board.state === 'archived') {
      status = 'abandoned'
      issues.push('Board is archived')
    } else if (board.state === 'deleted') {
      status = 'abandoned'
      issues.push('Board is deleted')
    }

    // Positive indicators
    if (itemCount > 20 && daysSinceActivity < 7) {
      status = 'healthy'
      recommendations.push('Board is well-utilized and active')
    }

    return {
      board,
      status,
      lastActivity,
      itemsCount: itemCount,
      collaboratorsCount: 0, // Would need user activity data
      issues,
      recommendations,
    }
  }

  analyzeWorkspaceHealth(workspace: MondayWorkspace, allBoards: MondayBoard[]): WorkspaceHealth {
    const workspaceBoards = allBoards.filter(board => board.workspace?.id === workspace.id)
    const boardHealthScores = workspaceBoards.map(board => this.analyzeBoardHealth(board))

    const boardsHealthy = boardHealthScores.filter(health => health.status === 'healthy').length
    const boardsWarning = boardHealthScores.filter(health => health.status === 'warning').length
    const boardsInactive = boardHealthScores.filter(health => 
      health.status === 'inactive' || health.status === 'abandoned'
    ).length

    const totalBoards = workspaceBoards.length
    
    // Calculate overall score (0-100)
    let overallScore = 0
    if (totalBoards > 0) {
      const healthyRatio = boardsHealthy / totalBoards
      const activeRatio = workspaceBoards.filter(b => b.state === 'active').length / totalBoards
      const utilizationRatio = Math.min(
        workspaceBoards.reduce((sum, b) => sum + (b.items_count || 0), 0) / (totalBoards * 10),
        1
      )
      
      overallScore = Math.round((healthyRatio * 50 + activeRatio * 30 + utilizationRatio * 20) * 100)
    }

    const recommendations: string[] = []
    
    if (boardsInactive > totalBoards * 0.3) {
      recommendations.push('High number of inactive boards - consider cleanup')
    }
    if (totalBoards === 0) {
      recommendations.push('No boards in workspace - consider adding content or archiving')
    }
    if (overallScore > 80) {
      recommendations.push('Workspace is well-organized and active')
    } else if (overallScore > 60) {
      recommendations.push('Good workspace health with room for optimization')
    } else {
      recommendations.push('Workspace needs attention - review board usage and organization')
    }

    return {
      workspace,
      boardsHealthy,
      boardsWarning,
      boardsInactive,
      totalBoards,
      overallScore,
      recommendations,
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private countRecentActivity(boards: MondayBoard[], since: Date): number {
    return boards.filter(board => {
      if (!board.updated_at) return false
      const lastUpdate = new Date(board.updated_at)
      return lastUpdate >= since
    }).length
  }

  calculateOverallHealthScore(orgData: OrganizationalStructure): number {
    if (orgData.boards.length === 0) return 0

    const boardHealthScores = orgData.boards.map(board => this.analyzeBoardHealth(board))
    
    const healthyBoards = boardHealthScores.filter(health => health.status === 'healthy').length
    const warningBoards = boardHealthScores.filter(health => health.status === 'warning').length
    const inactiveBoards = boardHealthScores.filter(health => health.status === 'inactive').length
    const abandonedBoards = boardHealthScores.filter(health => health.status === 'abandoned').length

    // Weighted scoring
    const totalBoards = orgData.boards.length
    const score = (
      (healthyBoards * 100) +
      (warningBoards * 60) +
      (inactiveBoards * 20) +
      (abandonedBoards * 0)
    ) / totalBoards

    return Math.round(score)
  }

  generateHealthRecommendations(orgData: OrganizationalStructure): string[] {
    const recommendations: string[] = []
    const healthMetrics = this.analyzeOrganizationHealth(orgData)

    // Overall recommendations
    if (healthMetrics.inactiveBoards.length > 0) {
      recommendations.push(`Consider archiving ${healthMetrics.inactiveBoards.length} inactive boards`)
    }

    if (healthMetrics.underutilizedBoards.length > 0) {
      recommendations.push(`Review ${healthMetrics.underutilizedBoards.length} underutilized boards for consolidation`)
    }

    const activeRatio = healthMetrics.activeBoards / healthMetrics.totalBoards
    if (activeRatio < 0.7) {
      recommendations.push('Less than 70% of boards are active - consider organizational cleanup')
    }

    if (healthMetrics.totalItems < healthMetrics.totalBoards * 5) {
      recommendations.push('Low item density - many boards may be unused or underutilized')
    }

    // Activity-based recommendations
    if (healthMetrics.activitySummary.weekly < healthMetrics.activeBoards * 0.3) {
      recommendations.push('Low weekly activity - boards may not be actively managed')
    }

    // Workspace-specific recommendations
    const workspaceHealthScores = orgData.workspaces.map(workspace => 
      this.analyzeWorkspaceHealth(workspace, orgData.boards)
    )

    const lowPerformingWorkspaces = workspaceHealthScores.filter(ws => ws.overallScore < 50)
    if (lowPerformingWorkspaces.length > 0) {
      recommendations.push(`${lowPerformingWorkspaces.length} workspaces need attention for better organization`)
    }

    return recommendations
  }

  // =============================================================================
  // EXPORT METRICS FOR VISUALIZATION
  // =============================================================================

  getHealthMetricsForVisualization(orgData: OrganizationalStructure): {
    overallScore: number
    boardStatusCounts: Record<string, number>
    workspaceScores: Array<{ name: string; score: number; boardCount: number }>
    recommendations: string[]
    trends: {
      dailyActivity: number
      weeklyActivity: number
      monthlyActivity: number
    }
  } {
    const healthMetrics = this.analyzeOrganizationHealth(orgData)
    const boardHealthScores = orgData.boards.map(board => this.analyzeBoardHealth(board))
    const workspaceHealthScores = orgData.workspaces.map(workspace => 
      this.analyzeWorkspaceHealth(workspace, orgData.boards)
    )

    // Count boards by status
    const boardStatusCounts = {
      healthy: boardHealthScores.filter(h => h.status === 'healthy').length,
      warning: boardHealthScores.filter(h => h.status === 'warning').length,
      inactive: boardHealthScores.filter(h => h.status === 'inactive').length,
      abandoned: boardHealthScores.filter(h => h.status === 'abandoned').length,
    }

    return {
      overallScore: this.calculateOverallHealthScore(orgData),
      boardStatusCounts,
      workspaceScores: workspaceHealthScores.map(ws => ({
        name: ws.workspace.name,
        score: ws.overallScore,
        boardCount: ws.totalBoards
      })),
      recommendations: this.generateHealthRecommendations(orgData),
      trends: {
        dailyActivity: healthMetrics.activitySummary.daily,
        weeklyActivity: healthMetrics.activitySummary.weekly,
        monthlyActivity: healthMetrics.activitySummary.monthly,
      }
    }
  }
}

// =============================================================================
// EXPORT DEFAULT INSTANCE
// =============================================================================

export const healthAnalyzer = new HealthAnalyzer()

// Convenience functions
export function analyzeOrganizationHealth(orgData: OrganizationalStructure): HealthMetrics {
  return healthAnalyzer.analyzeOrganizationHealth(orgData)
}

export function generateHealthRecommendations(orgData: OrganizationalStructure): string[] {
  return healthAnalyzer.generateHealthRecommendations(orgData)
}

export function getHealthDashboardData(orgData: OrganizationalStructure) {
  return healthAnalyzer.getHealthMetricsForVisualization(orgData)
}
