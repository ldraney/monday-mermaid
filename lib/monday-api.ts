// lib/monday-api.ts
// Monday.com GraphQL API client FOCUSED on priority workspaces only

import { config, getPriorityWorkspaceNames } from './config'
import type { 
  MondayWorkspace, 
  MondayBoard, 
  MondayColumn, 
  MondayUser,
  MondayApiResponse,
  OrganizationalStructure,
  DiscoveryOptions 
} from './types'

export class MondayAPI {
  private apiKey: string
  private apiUrl: string
  private headers: Record<string, string>

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.monday.apiKey
    this.apiUrl = config.monday.apiUrl
    this.headers = {
      'Authorization': this.apiKey,
      'Content-Type': 'application/json',
      'API-Version': config.monday.version,
    }
  }

  // =============================================================================
  // CORE API METHODS
  // =============================================================================

  private async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        query,
        variables: variables || {},
      }),
    })

    if (!response.ok) {
      throw new Error(`Monday.com API error: ${response.status} ${response.statusText}`)
    }

    const result: MondayApiResponse<T> = await response.json()

    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors.map(e => e.message).join(', ')
      throw new Error(`Monday.com GraphQL error: ${errorMessage}`)
    }

    return result.data
  }

  // =============================================================================
  // PRIORITY WORKSPACE FOCUSED DISCOVERY
  // =============================================================================

  async discoverPriorityWorkspaces(options: DiscoveryOptions = {}): Promise<OrganizationalStructure> {
    console.log('🎯 Starting FOCUSED discovery for priority workspaces...')
    
    const startTime = Date.now()
    const priorityWorkspaceNames = getPriorityWorkspaceNames()
    
    console.log(`🔍 Looking for workspaces: ${priorityWorkspaceNames.join(', ')}`)
    
    // Step 1: Get all workspaces and filter to priority ones
    const allWorkspaces = await this.getWorkspaces()
    const priorityWorkspaces = allWorkspaces.filter(workspace => 
      priorityWorkspaceNames.includes(workspace.name)
    )

    if (priorityWorkspaces.length === 0) {
      throw new Error(`No priority workspaces found. Looking for: ${priorityWorkspaceNames.join(', ')}. Found workspaces: ${allWorkspaces.map(w => w.name).join(', ')}`)
    }

    console.log(`✅ Found ${priorityWorkspaces.length}/${priorityWorkspaceNames.length} priority workspaces`)
    priorityWorkspaces.forEach(ws => console.log(`   - ${ws.name} (ID: ${ws.id})`))

    // Step 2: Get users (organizational context)
    const users = await this.getUsers()

    // Step 3: Get boards ONLY for priority workspaces
    const allBoards: MondayBoard[] = []
    for (const workspace of priorityWorkspaces) {
      console.log(`📋 Fetching boards for ${workspace.name}...`)
      const workspaceBoards = await this.getBoardsInWorkspace(workspace.id, options)
      allBoards.push(...workspaceBoards)
      console.log(`   Found ${workspaceBoards.length} boards`)
    }

    // Calculate health metrics for priority workspaces only
    const activeBoards = allBoards.filter(board => board.state === 'active')
    const totalItems = allBoards.reduce((sum, board) => sum + (board.items_count || 0), 0)

    const healthMetrics = {
      totalWorkspaces: priorityWorkspaces.length,
      totalBoards: allBoards.length,
      activeBoards: activeBoards.length,
      archivedBoards: allBoards.filter(board => board.state === 'archived').length,
      totalItems,
      inactiveBoards: [], // Will be calculated by health analyzer
      underutilizedBoards: [], // Will be calculated by health analyzer
      lastUpdated: new Date(),
      activitySummary: {
        daily: 0,
        weekly: 0,
        monthly: 0,
      },
    }

    const duration = Date.now() - startTime
    console.log(`✅ Priority workspace discovery complete in ${duration}ms`)
    console.log(`📊 Final results: ${priorityWorkspaces.length} workspaces, ${allBoards.length} boards, ${totalItems} items`)

    return {
      workspaces: priorityWorkspaces,
      boards: allBoards,
      relationships: [], // Will be discovered separately
      healthMetrics,
      users,
      lastScanned: new Date(),
    }
  }

  // Legacy method for backward compatibility
  async discoverOrganization(options: DiscoveryOptions = {}): Promise<OrganizationalStructure> {
    return this.discoverPriorityWorkspaces(options)
  }

  // =============================================================================
  // WORKSPACE AND BOARD METHODS (enhanced for priority focus)
  // =============================================================================

  async getWorkspaces(): Promise<MondayWorkspace[]> {
    const query = `
      query GetWorkspaces {
        workspaces {
          id
          name
          kind
          description
        }
      }
    `

    const result = await this.query<{ workspaces: any[] }>(query)
    
    return result.workspaces.map(workspace => ({
      id: workspace.id,
      name: workspace.name,
      kind: workspace.kind || 'open',
      description: workspace.description || null,
    }))
  }

  async getPriorityWorkspaces(): Promise<MondayWorkspace[]> {
    const allWorkspaces = await this.getWorkspaces()
    const priorityNames = getPriorityWorkspaceNames()
    
    const priorityWorkspaces = allWorkspaces.filter(workspace => 
      priorityNames.includes(workspace.name)
    )

    const found = priorityWorkspaces.map(w => w.name)
    const missing = priorityNames.filter(name => !found.includes(name))
    
    if (missing.length > 0) {
      console.warn(`⚠️ Missing priority workspaces: ${missing.join(', ')}`)
      console.log(`Available workspaces: ${allWorkspaces.map(w => w.name).join(', ')}`)
    }

    return priorityWorkspaces
  }

  async getBoardsInWorkspace(workspaceId: string, options: DiscoveryOptions = {}): Promise<MondayBoard[]> {
    const includeArchived = options.includeArchived ? ', archived' : ''
    const limit = options.maxBoards ? `, limit: ${options.maxBoards}` : ''
    
    const query = `
      query GetBoardsInWorkspace($workspaceId: [ID!]) {
        boards(workspace_ids: $workspaceId, state: active${includeArchived}${limit}) {
          id
          name
          description
          state
          board_folder_id
          board_kind
          workspace {
            id
            name
          }
          columns {
            id
            title
            type
            settings_str
            archived
          }
          items_count
          permissions
          tags {
            id
            name
            color
          }
          updated_at
        }
      }
    `

    const result = await this.query<{ boards: MondayBoard[] }>(query, {
      workspaceId: [workspaceId]
    })

    return result.boards
  }

  async getBoard(boardId: string): Promise<MondayBoard> {
    const query = `
      query GetBoard($boardId: [ID!]) {
        boards(ids: $boardId) {
          id
          name
          description
          state
          board_folder_id
          board_kind
          workspace {
            id
            name
          }
          columns {
            id
            title
            type
            settings_str
            archived
          }
          items_count
          permissions
          tags {
            id
            name
            color
          }
          updated_at
        }
      }
    `

    const result = await this.query<{ boards: MondayBoard[] }>(query, {
      boardId: [boardId]
    })

    if (!result.boards || result.boards.length === 0) {
      throw new Error(`Board ${boardId} not found`)
    }

    return result.boards[0]
  }

  async getUsers(): Promise<MondayUser[]> {
    const query = `
      query GetUsers {
        users {
          id
          name
          email
          enabled
          is_admin
          is_guest
          last_activity
        }
      }
    `

    const result = await this.query<{ users: MondayUser[] }>(query)
    return result.users
  }

  // =============================================================================
  // ENHANCED RELATIONSHIP DISCOVERY FOR PRIORITY WORKSPACES
  // =============================================================================

  async getBoardConnections(boardId: string): Promise<any[]> {
    console.log(`🔗 Discovering connections for board ${boardId}`)
    
    const query = `
      query GetBoardConnections($boardId: [ID!]) {
        boards(ids: $boardId) {
          id
          name
          columns {
            id
            title
            type
            settings_str
          }
        }
      }
    `

    const result = await this.query<{ boards: { id: string, name: string, columns: MondayColumn[] }[] }>(query, {
      boardId: [boardId]
    })

    if (!result.boards || result.boards.length === 0) {
      return []
    }

    const board = result.boards[0]
    const connections: any[] = []
    
    // Parse connect board columns and mirror columns
    for (const column of board.columns) {
      if (column.type === 'connect_boards' && column.settings_str) {
        try {
          const settings = JSON.parse(column.settings_str)
          if (settings.boardIds && Array.isArray(settings.boardIds)) {
            for (const targetBoardId of settings.boardIds) {
              connections.push({
                sourceBoard: boardId,
                sourceBoardName: board.name,
                targetBoard: targetBoardId,
                type: 'connect',
                columnId: column.id,
                columnTitle: column.title,
                connectionDetails: `Connect boards via "${column.title}"`
              })
            }
          }
        } catch (e) {
          console.warn(`Failed to parse connect_boards settings for column ${column.id}:`, e)
        }
      } else if (column.type === 'mirror' && column.settings_str) {
        try {
          const settings = JSON.parse(column.settings_str)
          if (settings.boardId) {
            connections.push({
              sourceBoard: boardId,
              sourceBoardName: board.name,
              targetBoard: settings.boardId,
              type: 'mirror',
              columnId: column.id,
              columnTitle: column.title,
              connectionDetails: `Mirror column "${column.title}" from target board`
            })
          }
        } catch (e) {
          console.warn(`Failed to parse mirror settings for column ${column.id}:`, e)
        }
      }
    }

    console.log(`🔗 Found ${connections.length} connections for board ${board.name}`)
    return connections
  }

  async discoverAllPriorityBoardRelationships(): Promise<any[]> {
    console.log('🕸️ Discovering ALL relationships within priority workspaces...')
    
    const priorityWorkspaces = await this.getPriorityWorkspaces()
    const allConnections: any[] = []
    
    for (const workspace of priorityWorkspaces) {
      const workspaceBoards = await this.getBoardsInWorkspace(workspace.id)
      
      for (const board of workspaceBoards) {
        const boardConnections = await this.getBoardConnections(board.id)
        allConnections.push(...boardConnections)
      }
    }

    console.log(`🕸️ Total connections discovered: ${allConnections.length}`)
    return allConnections
  }

  // =============================================================================
  // VALIDATION AND UTILITY METHODS
  // =============================================================================

  async validatePriorityWorkspaceSetup(): Promise<{
    isValid: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []
    
    try {
      const priorityNames = getPriorityWorkspaceNames()
      const allWorkspaces = await this.getWorkspaces()
      const found = allWorkspaces.filter(w => priorityNames.includes(w.name))
      
      if (found.length === 0) {
        issues.push('No priority workspaces found in Monday.com')
        recommendations.push('Check workspace names in config.priorityWorkspaces.workspaceNames')
        recommendations.push(`Available workspaces: ${allWorkspaces.map(w => w.name).join(', ')}`)
      } else if (found.length < priorityNames.length) {
        const missing = priorityNames.filter(name => !found.map(w => w.name).includes(name))
        issues.push(`Missing workspaces: ${missing.join(', ')}`)
        recommendations.push('Update config or check workspace names in Monday.com')
      }

      // Check board counts
      for (const workspace of found) {
        const boards = await this.getBoardsInWorkspace(workspace.id)
        if (boards.length === 0) {
          issues.push(`Workspace "${workspace.name}" has no boards`)
        } else if (boards.length > 20) {
          recommendations.push(`Workspace "${workspace.name}" has ${boards.length} boards - consider filtering`)
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      }
      
    } catch (error) {
      return {
        isValid: false,
        issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ['Check Monday.com API connectivity and permissions']
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const query = `
        query TestConnection {
          me {
            id
            name
          }
        }
      `
      
      const result = await this.query<{ me: { id: string, name: string } }>(query)
      console.log(`✅ Monday.com API connected successfully as ${result.me.name}`)
      
      // Also validate priority workspace setup
      const validation = await this.validatePriorityWorkspaceSetup()
      if (!validation.isValid) {
        console.warn('⚠️ Priority workspace setup issues:')
        validation.issues.forEach(issue => console.warn(`   - ${issue}`))
        validation.recommendations.forEach(rec => console.log(`💡 ${rec}`))
      }
      
      return true
    } catch (error) {
      console.error('❌ Monday.com API connection failed:', error)
      return false
    }
  }

  async getRateLimitStatus(): Promise<{ remaining: number, resetTime: Date }> {
    // Monday.com doesn't expose rate limit info in GraphQL
    // This is a placeholder for rate limit tracking
    return {
      remaining: config.monday.rateLimits.requestsPerHour,
      resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    }
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Create a default API instance
export const mondayApi = new MondayAPI()

// Helper function for quick priority workspace discovery
export async function quickPriorityDiscovery(): Promise<OrganizationalStructure> {
  return await mondayApi.discoverPriorityWorkspaces({
    includeArchived: false,
    maxBoards: 50, // Reasonable limit per workspace
  })
}

// Helper function to test API connection and validate setup
export async function testMondayConnection(): Promise<boolean> {
  return await mondayApi.testConnection()
}

// Helper function to get only priority workspaces
export async function getPriorityWorkspaces(): Promise<MondayWorkspace[]> {
  return await mondayApi.getPriorityWorkspaces()
}
