// lib/mermaid-generator.ts - MEANINGFUL PRIORITY WORKSPACE VERSION
// Dynamic Mermaid diagram generation focused on actionable priority workspace visualization

import type { 
  OrganizationalStructure, 
  MondayWorkspace, 
  MondayBoard, 
  BoardRelationship,
  MermaidDiagramConfig,
  MermaidNode,
  MermaidEdge
} from './types'
import { config, getPriorityWorkspaceNames, isPriorityWorkspace } from './config'

export class MermaidGenerator {
  private nodeCounter = 0
  private nodeMap = new Map<string, string>() // Maps entity ID to mermaid node ID

  // =============================================================================
  // MAIN DIAGRAM GENERATION - PRIORITY WORKSPACE FOCUSED
  // =============================================================================

  generateOrganizationChart(orgData: OrganizationalStructure, options: {
    showInactive?: boolean
    colorByHealth?: boolean
  } = {}): string {
    this.reset()

    const { showInactive = false, colorByHealth = true } = options
    const priorityWorkspaceNames = getPriorityWorkspaceNames()
    
    // Filter to only priority workspaces
    const priorityWorkspaces = orgData.workspaces.filter(w => 
      isPriorityWorkspace(w.name)
    )

    if (priorityWorkspaces.length === 0) {
      return this.generateErrorDiagram('No priority workspaces found. Check your workspace names in config.')
    }

    let diagram = `graph TD\n`
    let styles = ``

    console.log(`🎯 Generating diagram for ${priorityWorkspaces.length} priority workspaces`)

    // Add organization root
    const orgNode = this.createNodeId('org')
    diagram += `    ${orgNode}["🎯 Priority Workspaces<br/>${this.getTotalStats(orgData, priorityWorkspaces)}"]\n`

    // Add each priority workspace with detailed boards
    for (const workspace of priorityWorkspaces) {
      const workspaceNode = this.createNodeId(workspace.id)
      const workspaceBoards = this.getWorkspaceBoards(orgData, workspace.id, showInactive)
      const workspaceStats = this.getWorkspaceStats(workspaceBoards)
      
      diagram += `    ${workspaceNode}["🏢 ${this.escapeLabel(workspace.name)}<br/>${workspaceStats}"]\n`
      diagram += `    ${orgNode} --> ${workspaceNode}\n`

      // Add boards for this workspace with full details
      const boardsToShow = workspaceBoards.slice(0, config.priorityWorkspaces.displaySettings.maxBoardsPerWorkspace)
      
      for (const board of boardsToShow) {
        const boardNode = this.createNodeId(board.id)
        const boardLabel = this.createDetailedBoardLabel(board)
        
        diagram += `    ${boardNode}[${boardLabel}]\n`
        diagram += `    ${workspaceNode} --> ${boardNode}\n`

        // Add health-based styling
        if (colorByHealth) {
          const healthClass = this.getBoardHealthClass(board)
          styles += `    class ${boardNode} ${healthClass}\n`
        }
      }

      // Show truncation if there are more boards
      if (workspaceBoards.length > config.priorityWorkspaces.displaySettings.maxBoardsPerWorkspace) {
        const moreNode = this.createNodeId(`more_${workspace.id}`)
        const hiddenCount = workspaceBoards.length - config.priorityWorkspaces.displaySettings.maxBoardsPerWorkspace
        diagram += `    ${moreNode}["📋 ${hiddenCount} more boards..."]\n`
        diagram += `    ${workspaceNode} --> ${moreNode}\n`
        styles += `    class ${moreNode} moreStyle\n`
      }

      // Add workspace styling based on health
      const workspaceHealthClass = this.getWorkspaceHealthClass(workspaceBoards)
      styles += `    class ${workspaceNode} ${workspaceHealthClass}\n`
    }

    // Add board relationships between priority workspaces
    const priorityBoardIds = new Set(
      priorityWorkspaces.flatMap(ws => 
        this.getWorkspaceBoards(orgData, ws.id, showInactive).map(b => b.id)
      )
    )

    for (const relationship of orgData.relationships) {
      if (priorityBoardIds.has(relationship.sourceBoard.id) && 
          priorityBoardIds.has(relationship.targetBoard.id)) {
        
        const sourceNode = this.createNodeId(relationship.sourceBoard.id)
        const targetNode = this.createNodeId(relationship.targetBoard.id)
        const connectionLabel = this.getConnectionLabel(relationship.type)
        
        diagram += `    ${sourceNode} -.${connectionLabel}.-> ${targetNode}\n`
      }
    }

    // Add all style definitions
    styles += this.getComprehensiveStyles()

    return diagram + '\n' + styles
  }

  generateConnectionsView(boardId: string, orgData: OrganizationalStructure): string {
    this.reset()

    const centralBoard = orgData.boards.find(board => board.id === boardId)
    if (!centralBoard) {
      return this.generateErrorDiagram(`Board ${boardId} not found`)
    }

    // Only show if it's in a priority workspace
    if (!isPriorityWorkspace(centralBoard.workspace?.name || '')) {
      return this.generateErrorDiagram(`Board "${centralBoard.name}" is not in a priority workspace`)
    }

    let diagram = `graph TD\n`
    let styles = ``

    // Add the central board with detailed info
    const centralNode = this.createNodeId(centralBoard.id)
    const centralLabel = this.createDetailedBoardLabel(centralBoard)
    diagram += `    ${centralNode}[${centralLabel}]\n`
    
    // Style the central board prominently
    styles += `    class ${centralNode} centralBoard\n`

    // Find relationships involving this board
    const relationships = orgData.relationships.filter(rel => 
      rel.sourceBoard.id === boardId || rel.targetBoard.id === boardId
    )

    const connectedBoards = new Set<string>()
    
    // Add connected boards with detailed labels
    for (const rel of relationships.slice(0, 15)) { // Limit for performance
      const otherBoard = rel.sourceBoard.id === boardId ? rel.targetBoard : rel.sourceBoard
      
      // Only show connections to priority workspace boards
      if (!isPriorityWorkspace(otherBoard.workspace?.name || '')) {
        continue
      }
      
      const otherNode = this.createNodeId(otherBoard.id)
      
      if (!connectedBoards.has(otherBoard.id)) {
        const otherLabel = this.createDetailedBoardLabel(otherBoard)
        diagram += `    ${otherNode}[${otherLabel}]\n`
        connectedBoards.add(otherBoard.id)
      }

      // Add the connection with meaningful labels
      const connectionLabel = this.getDetailedConnectionLabel(rel)
      const isOutgoing = rel.sourceBoard.id === boardId
      
      if (isOutgoing) {
        diagram += `    ${centralNode} --"${connectionLabel}"--> ${otherNode}\n`
      } else {
        diagram += `    ${otherNode} --"${connectionLabel}"--> ${centralNode}\n`
      }

      // Style connected boards by health
      const healthClass = this.getBoardHealthClass(otherBoard)
      styles += `    class ${otherNode} ${healthClass}\n`
    }

    // Show if there are external connections
    const externalConnections = relationships.filter(rel => {
      const otherBoard = rel.sourceBoard.id === boardId ? rel.targetBoard : rel.sourceBoard
      return !isPriorityWorkspace(otherBoard.workspace?.name || '')
    })

    if (externalConnections.length > 0) {
      const externalNode = this.createNodeId('external_connections')
      diagram += `    ${externalNode}["🔗 ${externalConnections.length} external connections<br/>to other workspaces"]\n`
      diagram += `    ${centralNode} -.-> ${externalNode}\n`
      styles += `    class ${externalNode} externalStyle\n`
    }

    // Add comprehensive styles
    styles += this.getComprehensiveStyles()
    styles += `    classDef centralBoard fill:#10b981,stroke:#059669,stroke-width:4px,color:#ffffff\n`
    styles += `    classDef externalStyle fill:#f3f4f6,stroke:#d1d5db,stroke-width:1px,color:#6b7280\n`

    return diagram + '\n' + styles
  }

  generateHealthDashboard(orgData: OrganizationalStructure): string {
    this.reset()

    const priorityWorkspaces = orgData.workspaces.filter(w => isPriorityWorkspace(w.name))
    
    let diagram = `graph TD\n`
    let styles = ``

    // Health overview
    const healthNode = this.createNodeId('health')
    const overallStats = this.getTotalStats(orgData, priorityWorkspaces)
    diagram += `    ${healthNode}["🏥 Priority Workspace Health<br/>${overallStats}"]\n`

    // Health categories for priority workspaces only
    const allPriorityBoards = priorityWorkspaces.flatMap(ws => 
      this.getWorkspaceBoards(orgData, ws.id, false)
    )

    const healthStats = this.calculateHealthStats(allPriorityBoards)
    
    const categories = [
      { id: 'healthy', name: 'Healthy Boards', count: healthStats.healthy, status: 'healthy' },
      { id: 'warning', name: 'Warning Boards', count: healthStats.warning, status: 'warning' },
      { id: 'inactive', name: 'Inactive Boards', count: healthStats.inactive, status: 'inactive' }
    ]

    for (const category of categories) {
      const categoryNode = this.createNodeId(category.id)
      const icon = this.getHealthIcon(category.status)
      
      diagram += `    ${categoryNode}["${icon} ${category.name}<br/>${category.count} boards"]\n`
      diagram += `    ${healthNode} --> ${categoryNode}\n`
      
      const statusClass = `health${category.status.charAt(0).toUpperCase() + category.status.slice(1)}`
      styles += `    class ${categoryNode} ${statusClass}\n`
    }

    // Show each priority workspace with health breakdown
    for (const workspace of priorityWorkspaces) {
      const workspaceBoards = this.getWorkspaceBoards(orgData, workspace.id, false)
      const wsHealthStats = this.calculateHealthStats(workspaceBoards)
      const workspaceScore = this.calculateWorkspaceHealthScore(wsHealthStats, workspaceBoards)
      
      const workspaceNode = this.createNodeId(`ws_health_${workspace.id}`)
      diagram += `    ${workspaceNode}["🏢 ${this.escapeLabel(workspace.name)}<br/>Score: ${workspaceScore}/100<br/>${workspaceBoards.length} boards"]\n`
      
      // Connect to appropriate health category
      const primaryCategory = wsHealthStats.healthy > wsHealthStats.warning ? 'healthy' : 
                             wsHealthStats.warning > wsHealthStats.inactive ? 'warning' : 'inactive'
      const categoryNode = this.createNodeId(primaryCategory)
      diagram += `    ${categoryNode} --> ${workspaceNode}\n`
      
      const healthClass = this.getHealthClassByScore(workspaceScore)
      styles += `    class ${workspaceNode} ${healthClass}\n`
    }

    // Add health style definitions
    styles += this.getHealthDashboardStyles()
    styles += `    class ${healthNode} healthMain\n`

    return diagram + '\n' + styles
  }

  // =============================================================================
  // UTILITY METHODS FOR MEANINGFUL LABELS AND STATS
  // =============================================================================

  private createDetailedBoardLabel(board: MondayBoard): string {
    const icon = this.getBoardIcon(board)
    const name = this.escapeLabel(board.name)
    const itemCount = board.items_count || 0
    
    let label = `"${icon} ${name}<br/>${itemCount} items`
    
    // Add health indicator if enabled
    if (config.priorityWorkspaces.displaySettings.showHealthIndicators) {
      const healthIcon = this.getBoardHealthIcon(board)
      label += ` ${healthIcon}`
    }
    
    // Add last activity if enabled and available
    if (config.priorityWorkspaces.displaySettings.showLastActivity && board.updated_at) {
      const lastActivity = this.formatLastActivity(board.updated_at)
      label += `<br/>Updated: ${lastActivity}`
    }
    
    label += `"`
    return label
  }

  private getTotalStats(orgData: OrganizationalStructure, priorityWorkspaces: MondayWorkspace[]): string {
    const totalBoards = priorityWorkspaces.reduce((sum, ws) => 
      sum + this.getWorkspaceBoards(orgData, ws.id, false).length, 0
    )
    const totalItems = priorityWorkspaces.reduce((sum, ws) => 
      sum + this.getWorkspaceBoards(orgData, ws.id, false).reduce((wsSum, board) => 
        wsSum + (board.items_count || 0), 0
      ), 0
    )
    
    return `${priorityWorkspaces.length} workspaces • ${totalBoards} boards • ${totalItems.toLocaleString()} items`
  }

  private getWorkspaceStats(boards: MondayBoard[]): string {
    const totalItems = boards.reduce((sum, board) => sum + (board.items_count || 0), 0)
    const activeBoards = boards.filter(board => board.state === 'active').length
    
    return `${activeBoards}/${boards.length} active • ${totalItems} items`
  }

  private getWorkspaceBoards(orgData: OrganizationalStructure, workspaceId: string, includeInactive: boolean): MondayBoard[] {
    let boards = orgData.boards.filter(board => board.workspace?.id === workspaceId)
    
    if (!includeInactive) {
      boards = boards.filter(board => board.state === 'active')
    }
    
    // Apply board filters from config
    const filters = config.priorityWorkspaces.boardFilters
    
    if (!filters.includeArchived) {
      boards = boards.filter(board => board.state !== 'archived')
    }
    
    if (filters.minItemsToShow > 0) {
      boards = boards.filter(board => (board.items_count || 0) >= filters.minItemsToShow)
    }
    
    return boards
  }

  private calculateHealthStats(boards: MondayBoard[]): { healthy: number, warning: number, inactive: number } {
    return {
      healthy: boards.filter(b => this.getBoardHealthStatus(b) === 'healthy').length,
      warning: boards.filter(b => this.getBoardHealthStatus(b) === 'warning').length,
      inactive: boards.filter(b => this.getBoardHealthStatus(b) === 'inactive').length
    }
  }

  private getBoardHealthStatus(board: MondayBoard): 'healthy' | 'warning' | 'inactive' {
    if (board.state !== 'active') return 'inactive'
    
    const itemCount = board.items_count || 0
    if (itemCount === 0) return 'inactive'
    if (itemCount < config.health.underutilizedItemsThreshold) return 'warning'
    
    if (board.updated_at) {
      const daysSinceUpdate = (Date.now() - new Date(board.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceUpdate > config.health.inactiveDaysThreshold) return 'inactive'
      if (daysSinceUpdate > config.health.inactiveDaysThreshold / 2) return 'warning'
    }
    
    return 'healthy'
  }

  private getBoardHealthIcon(board: MondayBoard): string {
    const status = this.getBoardHealthStatus(board)
    switch (status) {
      case 'healthy': return '✅'
      case 'warning': return '⚠️'
      case 'inactive': return '😴'
      default: return '❓'
    }
  }

  private formatLastActivity(updatedAt: string): string {
    const date = new Date(updatedAt)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff === 0) return 'today'
    if (daysDiff === 1) return 'yesterday'
    if (daysDiff < 7) return `${daysDiff}d ago`
    if (daysDiff < 30) return `${Math.floor(daysDiff / 7)}w ago`
    return `${Math.floor(daysDiff / 30)}m ago`
  }

  private getDetailedConnectionLabel(relationship: BoardRelationship): string {
    switch (relationship.type) {
      case 'dependency': return '📋 Depends on'
      case 'mirror': return '🔄 Mirrors'
      case 'connect': return '🔗 Connected'
      case 'integration': return '⚡ Integrates'
      default: return '→'
    }
  }

  private calculateWorkspaceHealthScore(healthStats: { healthy: number, warning: number, inactive: number }, boards: MondayBoard[]): number {
    if (boards.length === 0) return 0
    
    const total = boards.length
    const score = (healthStats.healthy * 100 + healthStats.warning * 60 + healthStats.inactive * 20) / total
    
    return Math.round(score)
  }

  // =============================================================================
  // STYLING AND VISUAL METHODS
  // =============================================================================

  private getBoardHealthClass(board: MondayBoard): string {
    const status = this.getBoardHealthStatus(board)
    switch (status) {
      case 'healthy': return 'healthyBoard'
      case 'warning': return 'warningBoard'
      case 'inactive': return 'inactiveBoard'
      default: return 'unknownBoard'
    }
  }

  private getWorkspaceHealthClass(boards: MondayBoard[]): string {
    const healthStats = this.calculateHealthStats(boards)
    const score = this.calculateWorkspaceHealthScore(healthStats, boards)
    
    if (score > 80) return 'healthyWorkspace'
    if (score > 60) return 'warningWorkspace'
    return 'inactiveWorkspace'
  }

  private getHealthClassByScore(score: number): string {
    if (score > 80) return 'healthyBoard'
    if (score > 60) return 'warningBoard'
    return 'inactiveBoard'
  }

  private getComprehensiveStyles(): string {
    const colors = config.priorityWorkspaces.displaySettings.healthColors
    
    return `
    classDef healthyBoard fill:${colors.healthy},stroke:#059669,stroke-width:2px,color:#ffffff
    classDef warningBoard fill:${colors.warning},stroke:#d97706,stroke-width:2px,color:#ffffff
    classDef inactiveBoard fill:${colors.inactive},stroke:#dc2626,stroke-width:2px,color:#ffffff
    classDef unknownBoard fill:${colors.abandoned},stroke:#4b5563,stroke-width:1px,color:#ffffff
    
    classDef healthyWorkspace fill:#3b82f6,stroke:#2563eb,stroke-width:3px,color:#ffffff
    classDef warningWorkspace fill:#f59e0b,stroke:#d97706,stroke-width:3px,color:#ffffff
    classDef inactiveWorkspace fill:#ef4444,stroke:#dc2626,stroke-width:3px,color:#ffffff
    
    classDef moreStyle fill:#f3f4f6,stroke:#d1d5db,stroke-width:1px,color:#6b7280
    classDef orgStyle fill:#1e293b,stroke:#334155,stroke-width:3px,color:#ffffff
    `
  }

  private getHealthDashboardStyles(): string {
    return `
    classDef healthHealthy fill:#10b981,stroke:#059669,stroke-width:2px,color:#ffffff
    classDef healthWarning fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#ffffff
    classDef healthInactive fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#ffffff
    classDef healthMain fill:#1e293b,stroke:#334155,stroke-width:3px,color:#ffffff
    `
  }

  // =============================================================================
  // BASIC UTILITY METHODS (unchanged)
  // =============================================================================

  private reset(): void {
    this.nodeCounter = 0
    this.nodeMap.clear()
  }

  private createNodeId(entityId: string): string {
    if (!this.nodeMap.has(entityId)) {
      this.nodeMap.set(entityId, `n${this.nodeCounter++}`)
    }
    return this.nodeMap.get(entityId)!
  }

  private escapeLabel(text: string): string {
    return text.replace(/"/g, '\\"').replace(/\n/g, '<br/>')
  }

  private getBoardIcon(board: MondayBoard): string {
    switch (board.board_kind) {
      case 'private': return '🔒'
      case 'shareable': return '🔗'
      default: return '📋'
    }
  }

  private getConnectionLabel(type: string): string {
    switch (type) {
      case 'dependency': return '→'
      case 'mirror': return '↔'
      case 'connect': return '🔗'
      case 'integration': return '⚡'
      default: return '--'
    }
  }

  private getHealthIcon(status: string): string {
    switch (status) {
      case 'healthy': return '✅'
      case 'warning': return '⚠️'
      case 'inactive': return '😴'
      default: return '📊'
    }
  }

  private generateErrorDiagram(message: string): string {
    return `graph TD
    error["❌ ${message}"]
    classDef errorStyle fill:#fef2f2,stroke:#fecaca,stroke-width:2px,color:#991b1b
    class error errorStyle`
  }
}

// =============================================================================
// EXPORT DEFAULT INSTANCE AND CONVENIENCE FUNCTIONS
// =============================================================================

export const mermaidGenerator = new MermaidGenerator()

// Convenience functions for common diagram types
export function generateOrgChart(orgData: OrganizationalStructure, options?: any): string {
  return mermaidGenerator.generateOrganizationChart(orgData, options)
}

export function generateBoardConnections(boardId: string, orgData: OrganizationalStructure): string {
  return mermaidGenerator.generateConnectionsView(boardId, orgData)
}

export function generateWorkspaceView(workspaceId: string, orgData: OrganizationalStructure): string {
  // For priority workspace focus, use the main org chart filtered to one workspace
  const workspace = orgData.workspaces.find(w => w.id === workspaceId)
  if (!workspace || !isPriorityWorkspace(workspace.name)) {
    return mermaidGenerator.generateErrorDiagram(`Workspace not found or not a priority workspace`)
  }
  
  return mermaidGenerator.generateOrganizationChart(orgData)
}

export function generateHealthView(orgData: OrganizationalStructure): string {
  return mermaidGenerator.generateHealthDashboard(orgData)
}
