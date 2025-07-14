// lib/mermaid-generator.ts - OPTIMIZED VERSION
// Dynamic Mermaid diagram generation engine for organizational visualization

import type { 
  OrganizationalStructure, 
  MondayWorkspace, 
  MondayBoard, 
  BoardRelationship,
  MermaidDiagramConfig,
  MermaidNode,
  MermaidEdge
} from './types'
import { config } from './config'

export class MermaidGenerator {
  private nodeCounter = 0
  private nodeMap = new Map<string, string>() // Maps entity ID to mermaid node ID

  // =============================================================================
  // MAIN DIAGRAM GENERATION METHODS
  // =============================================================================

  generateOrganizationChart(orgData: OrganizationalStructure, options: {
    showInactive?: boolean
    maxDepth?: number
    workspaceFilter?: string[]
    colorByHealth?: boolean
    maxWorkspaces?: number
    maxBoardsPerWorkspace?: number
  } = {}): string {
    this.reset()

    const { 
      showInactive = false, 
      maxDepth = 3, 
      workspaceFilter, 
      colorByHealth = true,
      maxWorkspaces = 10, // LIMIT FOR PERFORMANCE
      maxBoardsPerWorkspace = 8 // LIMIT FOR PERFORMANCE
    } = options

    let diagram = `graph TD\n`
    let styles = ``
    
    // Filter and limit workspaces for performance
    let workspaces = workspaceFilter 
      ? orgData.workspaces.filter(w => workspaceFilter.includes(w.id))
      : orgData.workspaces

    // IMPORTANT: Limit workspaces to prevent diagram explosion
    if (workspaces.length > maxWorkspaces) {
      console.log(`🚨 Limiting diagram to ${maxWorkspaces} workspaces (of ${workspaces.length} total) for performance`)
      workspaces = workspaces.slice(0, maxWorkspaces)
    }

    // Add organization root if multiple workspaces
    const orgNode = this.createNodeId('org')
    if (workspaces.length > 1) {
      diagram += `    ${orgNode}["🏢 Organization<br/>${orgData.healthMetrics.totalBoards} boards<br/>(Showing ${workspaces.length}/${orgData.workspaces.length} workspaces)"]\n`
      styles += `    classDef orgStyle fill:#1e293b,stroke:#334155,stroke-width:3px,color:#ffffff\n`
      styles += `    class ${orgNode} orgStyle\n`
    }

    // Add workspaces
    for (const workspace of workspaces) {
      const workspaceNode = this.createNodeId(workspace.id)
      const workspaceBoards = orgData.boards.filter(board => board.workspace?.id === workspace.id)
      
      diagram += `    ${workspaceNode}["🏢 ${this.escapeLabel(workspace.name)}<br/>${workspaceBoards.length} boards"]\n`
      
      if (workspaces.length > 1) {
        diagram += `    ${orgNode} --> ${workspaceNode}\n`
      }

      // Add boards for this workspace (LIMITED)
      const filteredBoards = showInactive 
        ? workspaceBoards
        : workspaceBoards.filter(board => board.state === 'active')

      // PERFORMANCE LIMIT: Only show first N boards per workspace
      const limitedBoards = filteredBoards.slice(0, maxBoardsPerWorkspace)
      
      for (const board of limitedBoards) {
        const boardNode = this.createNodeId(board.id)
        const boardLabel = this.createBoardLabel(board)
        
        diagram += `    ${boardNode}[${boardLabel}]\n`
        diagram += `    ${workspaceNode} --> ${boardNode}\n`

        // Add health-based styling
        if (colorByHealth) {
          const healthClass = this.getHealthClass(board)
          styles += `    class ${boardNode} ${healthClass}\n`
        }
      }

      // Show truncation message if there are more boards
      if (filteredBoards.length > maxBoardsPerWorkspace) {
        const moreNode = this.createNodeId(`more_${workspace.id}`)
        const hiddenCount = filteredBoards.length - maxBoardsPerWorkspace
        diagram += `    ${moreNode}["... and ${hiddenCount} more boards"]\n`
        diagram += `    ${workspaceNode} --> ${moreNode}\n`
        styles += `    classDef moreStyle fill:#f3f4f6,stroke:#d1d5db,stroke-width:1px,color:#6b7280\n`
        styles += `    class ${moreNode} moreStyle\n`
      }

      // Add workspace styling
      styles += `    classDef workspaceStyle fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#ffffff\n`
      styles += `    class ${workspaceNode} workspaceStyle\n`
    }

    // Add truncation message if there are more workspaces
    if (orgData.workspaces.length > maxWorkspaces) {
      const moreWsNode = this.createNodeId('more_workspaces')
      const hiddenWsCount = orgData.workspaces.length - maxWorkspaces
      diagram += `    ${moreWsNode}["... and ${hiddenWsCount} more workspaces"]\n`
      if (workspaces.length > 1) {
        diagram += `    ${orgNode} --> ${moreWsNode}\n`
      }
      styles += `    classDef moreStyle fill:#f3f4f6,stroke:#d1d5db,stroke-width:1px,color:#6b7280\n`
      styles += `    class ${moreWsNode} moreStyle\n`
    }

    // Add health-based style definitions
    if (colorByHealth) {
      styles += this.getHealthStyles()
    }

    return diagram + '\n' + styles
  }

  generateConnectionsView(boardId: string, orgData: OrganizationalStructure, depth: number = 2): string {
    this.reset()

    const centralBoard = orgData.boards.find(board => board.id === boardId)
    if (!centralBoard) {
      return `graph TD\n    error["Board not found"]\n`
    }

    let diagram = `graph TD\n`
    let styles = ``

    // Add the central board
    const centralNode = this.createNodeId(centralBoard.id)
    diagram += `    ${centralNode}[${this.createBoardLabel(centralBoard)}]\n`
    
    // Style the central board prominently
    styles += `    classDef centralBoard fill:#10b981,stroke:#059669,stroke-width:4px,color:#ffffff\n`
    styles += `    class ${centralNode} centralBoard\n`

    // Find all relationships involving this board
    const relationships = orgData.relationships.filter(rel => 
      rel.sourceBoard.id === boardId || rel.targetBoard.id === boardId
    )

    const connectedBoardIds = new Set<string>()
    
    // Add directly connected boards (limited for performance)
    for (const rel of relationships.slice(0, 10)) { // LIMIT CONNECTIONS
      const otherBoard = rel.sourceBoard.id === boardId ? rel.targetBoard : rel.sourceBoard
      const otherNode = this.createNodeId(otherBoard.id)
      
      if (!connectedBoardIds.has(otherBoard.id)) {
        diagram += `    ${otherNode}[${this.createBoardLabel(otherBoard)}]\n`
        connectedBoardIds.add(otherBoard.id)
      }

      // Add the connection
      const connectionLabel = this.getConnectionLabel(rel.type)
      const isOutgoing = rel.sourceBoard.id === boardId
      
      if (isOutgoing) {
        diagram += `    ${centralNode} --${connectionLabel}--> ${otherNode}\n`
      } else {
        diagram += `    ${otherNode} --${connectionLabel}--> ${centralNode}\n`
      }

      // Style connected boards
      const healthClass = this.getHealthClass(otherBoard)
      styles += `    class ${otherNode} ${healthClass}\n`
    }

    // Show truncation if there are many relationships
    if (relationships.length > 10) {
      const moreNode = this.createNodeId('more_connections')
      diagram += `    ${moreNode}["... and ${relationships.length - 10} more connections"]\n`
      diagram += `    ${centralNode} -.-> ${moreNode}\n`
      styles += `    classDef moreStyle fill:#f3f4f6,stroke:#d1d5db,stroke-width:1px,color:#6b7280\n`
      styles += `    class ${moreNode} moreStyle\n`
    }

    // Add health styles
    styles += this.getHealthStyles()

    return diagram + '\n' + styles
  }

  generateWorkspaceDetail(workspaceId: string, orgData: OrganizationalStructure): string {
    this.reset()

    const workspace = orgData.workspaces.find(w => w.id === workspaceId)
    if (!workspace) {
      return `graph TD\n    error["Workspace not found"]\n`
    }

    const workspaceBoards = orgData.boards.filter(board => board.workspace?.id === workspaceId)
    
    let diagram = `graph TD\n`
    let styles = ``

    // Add workspace header
    const workspaceNode = this.createNodeId(workspaceId)
    diagram += `    ${workspaceNode}["🏢 ${this.escapeLabel(workspace.name)}<br/>${workspaceBoards.length} boards"]\n`
    
    // Group boards by state
    const activeBoards = workspaceBoards.filter(board => board.state === 'active')
    const archivedBoards = workspaceBoards.filter(board => board.state === 'archived')

    // PERFORMANCE LIMIT: Only show first 15 boards
    const maxBoards = 15
    const limitedActiveBoards = activeBoards.slice(0, maxBoards)

    // Add active boards
    if (limitedActiveBoards.length > 0) {
      for (const board of limitedActiveBoards) {
        const boardNode = this.createNodeId(board.id)
        diagram += `    ${boardNode}[${this.createBoardLabel(board)}]\n`
        diagram += `    ${workspaceNode} --> ${boardNode}\n`
        
        const healthClass = this.getHealthClass(board)
        styles += `    class ${boardNode} ${healthClass}\n`
      }

      // Show truncation if there are more active boards
      if (activeBoards.length > maxBoards) {
        const moreNode = this.createNodeId('more_active')
        diagram += `    ${moreNode}["... and ${activeBoards.length - maxBoards} more active boards"]\n`
        diagram += `    ${workspaceNode} --> ${moreNode}\n`
        styles += `    classDef moreStyle fill:#f3f4f6,stroke:#d1d5db,stroke-width:1px,color:#6b7280\n`
        styles += `    class ${moreNode} moreStyle\n`
      }
    }

    // Add archived boards (if any, limited display)
    if (archivedBoards.length > 0) {
      const archivedNode = this.createNodeId('archived')
      diagram += `    ${archivedNode}["📦 Archived<br/>${archivedBoards.length} boards"]\n`
      diagram += `    ${workspaceNode} --> ${archivedNode}\n`
      styles += `    classDef archivedStyle fill:#64748b,stroke:#475569,stroke-width:1px,color:#ffffff\n`
      styles += `    class ${archivedNode} archivedStyle\n`
    }

    // Add workspace styling
    styles += `    classDef workspaceStyle fill:#3b82f6,stroke:#2563eb,stroke-width:3px,color:#ffffff\n`
    styles += `    class ${workspaceNode} workspaceStyle\n`

    // Add health styles
    styles += this.getHealthStyles()

    return diagram + '\n' + styles
  }

  generateHealthDashboard(orgData: OrganizationalStructure): string {
    this.reset()

    let diagram = `graph TD\n`
    let styles = ``

    // Organization health overview
    const healthNode = this.createNodeId('health')
    const healthScore = this.calculateOverallHealthScore(orgData)
    diagram += `    ${healthNode}["🏥 Organization Health<br/>Score: ${healthScore}/100<br/>${orgData.workspaces.length} workspaces, ${orgData.boards.length} boards"]\n`

    // Health categories
    const categories = [
      { id: 'active', name: 'Active Boards', count: orgData.healthMetrics.activeBoards, status: 'healthy' },
      { id: 'inactive', name: 'Inactive Boards', count: orgData.healthMetrics.inactiveBoards.length, status: 'warning' },
      { id: 'archived', name: 'Archived Boards', count: orgData.healthMetrics.archivedBoards, status: 'neutral' }
    ]

    for (const category of categories) {
      const categoryNode = this.createNodeId(category.id)
      const icon = this.getHealthIcon(category.status)
      
      diagram += `    ${categoryNode}["${icon} ${category.name}<br/>${category.count} boards"]\n`
      diagram += `    ${healthNode} --> ${categoryNode}\n`
      
      const statusClass = `health${category.status.charAt(0).toUpperCase() + category.status.slice(1)}`
      styles += `    class ${categoryNode} ${statusClass}\n`
    }

    // Add top 5 workspaces by board count (limited for performance)
    const topWorkspaces = orgData.workspaces
      .map(workspace => ({
        workspace,
        boardCount: orgData.boards.filter(board => board.workspace?.id === workspace.id).length,
        activeCount: orgData.boards.filter(board => board.workspace?.id === workspace.id && board.state === 'active').length
      }))
      .sort((a, b) => b.boardCount - a.boardCount)
      .slice(0, 5) // LIMIT TO TOP 5

    for (const { workspace, boardCount, activeCount } of topWorkspaces) {
      const workspaceScore = this.calculateWorkspaceHealth(workspace, orgData.boards.filter(b => b.workspace?.id === workspace.id))
      
      const workspaceNode = this.createNodeId(`ws_${workspace.id}`)
      diagram += `    ${workspaceNode}["🏢 ${this.escapeLabel(workspace.name)}<br/>${activeCount}/${boardCount} active • ${workspaceScore}/100"]\n`
      
      // Connect to appropriate health category
      const healthCategory = workspaceScore > 80 ? 'active' : workspaceScore > 50 ? 'inactive' : 'archived'
      const categoryNode = this.createNodeId(healthCategory)
      diagram += `    ${categoryNode} --> ${workspaceNode}\n`
      
      const healthClass = this.getHealthClassByScore(workspaceScore)
      styles += `    class ${workspaceNode} ${healthClass}\n`
    }

    // Show truncation if there are more workspaces
    if (orgData.workspaces.length > 5) {
      const moreNode = this.createNodeId('more_workspaces_health')
      diagram += `    ${moreNode}["... and ${orgData.workspaces.length - 5} more workspaces"]\n`
      diagram += `    ${healthNode} --> ${moreNode}\n`
      styles += `    classDef moreStyle fill:#f3f4f6,stroke:#d1d5db,stroke-width:1px,color:#6b7280\n`
      styles += `    class ${moreNode} moreStyle\n`
    }

    // Health style definitions
    styles += `
    classDef healthHealthy fill:#10b981,stroke:#059669,stroke-width:2px,color:#ffffff
    classDef healthWarning fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#ffffff
    classDef healthNeutral fill:#6b7280,stroke:#4b5563,stroke-width:2px,color:#ffffff
    classDef healthMain fill:#1e293b,stroke:#334155,stroke-width:3px,color:#ffffff
    `
    styles += `    class ${healthNode} healthMain\n`

    return diagram + '\n' + styles
  }

  // =============================================================================
  // UTILITY METHODS (unchanged from original)
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

  private createBoardLabel(board: MondayBoard): string {
    const icon = this.getBoardIcon(board)
    const name = this.escapeLabel(board.name)
    const itemCount = board.items_count || 0
    
    return `"${icon} ${name}<br/>${itemCount} items"`
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

  private getHealthClass(board: MondayBoard): string {
    switch (board.state) {
      case 'active': return 'healthyBoard'
      case 'archived': return 'archivedBoard'
      default: return 'inactiveBoard'
    }
  }

  private getHealthClassByScore(score: number): string {
    if (score > 80) return 'healthyBoard'
    if (score > 50) return 'warningBoard'
    return 'inactiveBoard'
  }

  private getConnectionLabel(type: string): string {
    switch (type) {
      case 'dependency': return '➤'
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
      case 'critical': return '🚨'
      default: return '📊'
    }
  }

  private getHealthStyles(): string {
    return `
    classDef healthyBoard fill:#10b981,stroke:#059669,stroke-width:2px,color:#ffffff
    classDef warningBoard fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#ffffff
    classDef inactiveBoard fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#ffffff
    classDef archivedBoard fill:#6b7280,stroke:#4b5563,stroke-width:1px,color:#ffffff
    `
  }

  private calculateOverallHealthScore(orgData: OrganizationalStructure): number {
    if (orgData.boards.length === 0) return 0
    
    const activeRatio = orgData.healthMetrics.activeBoards / orgData.healthMetrics.totalBoards
    const itemsPerBoard = orgData.healthMetrics.totalItems / orgData.healthMetrics.totalBoards
    
    let score = activeRatio * 60 // 60% weight for active boards
    score += Math.min(itemsPerBoard / 10, 1) * 40 // 40% weight for utilization
    
    return Math.round(score * 100) / 100
  }

  private calculateWorkspaceHealth(workspace: MondayWorkspace, boards: MondayBoard[]): number {
    if (boards.length === 0) return 0
    
    const activeBoards = boards.filter(board => board.state === 'active').length
    const totalItems = boards.reduce((sum, board) => sum + (board.items_count || 0), 0)
    
    const activeRatio = activeBoards / boards.length
    const avgItemsPerBoard = totalItems / boards.length
    
    let score = activeRatio * 70
    score += Math.min(avgItemsPerBoard / 15, 1) * 30
    
    return Math.round(score * 100)
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
  return mermaidGenerator.generateWorkspaceDetail(workspaceId, orgData)
}

export function generateHealthView(orgData: OrganizationalStructure): string {
  return mermaidGenerator.generateHealthDashboard(orgData)
}
