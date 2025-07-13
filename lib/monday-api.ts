// lib/monday-api.ts
// Monday.com GraphQL API client for organizational discovery and management

import { config } from './config'
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
  // ORGANIZATIONAL DISCOVERY METHODS
  // =============================================================================

  async discoverOrganization(options: DiscoveryOptions = {}): Promise<OrganizationalStructure> {
    console.log('🔍 Starting Monday.com organizational discovery...')
    
    const startTime = Date.now()
    
    // Fetch all organizational data in parallel
    const [workspaces, users] = await Promise.all([
      this.getWorkspaces(),
      this.getUsers(),
    ])

    // Fetch boards for all workspaces
    const allBoards: MondayBoard[] = []
    for (const workspace of workspaces) {
      const workspaceBoards = await this.getBoardsInWorkspace(workspace.id, options)
      allBoards.push(...workspaceBoards)
    }

    // Basic health metrics calculation
    const activeBoards = allBoards.filter(board => board.state === 'active')
    const totalItems = allBoards.reduce((sum, board) => sum + (board.items_count || 0), 0)

    const healthMetrics = {
      totalWorkspaces: workspaces.length,
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
    console.log(`✅ Discovery complete in ${duration}ms`)
    console.log(`   Found: ${workspaces.length} workspaces, ${allBoards.length} boards, ${totalItems} items`)

    return {
      workspaces,
      boards: allBoards,
      relationships: [], // Will be discovered separately
      healthMetrics,
      users,
      lastScanned: new Date(),
    }
  }

  async getWorkspaces(): Promise<MondayWorkspace[]> {
    // Fixed query - only use fields that actually exist
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
    
    // Transform to match our interface
    return result.workspaces.map(workspace => ({
      id: workspace.id,
      name: workspace.name,
      kind: workspace.kind || 'open',
      description: workspace.description || null,
      // Remove settings field since it doesn't work
    }))
  }

  async getBoardsInWorkspace(workspaceId: string, options: DiscoveryOptions = {}): Promise<MondayBoard[]> {
    const includeArchived = options.includeArchived ? ', archived' : ''
    
    const query = `
      query GetBoardsInWorkspace($workspaceId: [ID!]) {
        boards(workspace_ids: $workspaceId, state: active${includeArchived}) {
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
  // RELATIONSHIP DISCOVERY METHODS
  // =============================================================================

  async getBoardConnections(boardId: string): Promise<any[]> {
    // Monday.com connections are complex - this is a simplified version
    // Real implementation would need to check:
    // 1. Connect boards columns
    // 2. Mirror columns
    // 3. Dependencies 
    // 4. Automations that link boards
    
    const query = `
      query GetBoardConnections($boardId: [ID!]) {
        boards(ids: $boardId) {
          columns {
            id
            title
            type
            settings_str
          }
        }
      }
    `

    const result = await this.query<{ boards: { columns: MondayColumn[] }[] }>(query, {
      boardId: [boardId]
    })

    // Parse connect board columns from settings
    const connections: any[] = []
    
    if (result.boards[0]) {
      for (const column of result.boards[0].columns) {
        if (column.type === 'connect_boards' && column.settings_str) {
          try {
            const settings = JSON.parse(column.settings_str)
            if (settings.boardIds) {
              connections.push({
                sourceBoard: boardId,
                targetBoards: settings.boardIds,
                type: 'connect',
                columnId: column.id,
                columnTitle: column.title,
              })
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    }

    return connections
  }

  // =============================================================================
  // BOARD MANAGEMENT METHODS (for future management features)
  // =============================================================================

  async createBoard(workspaceId: string, name: string, kind: string = 'public'): Promise<MondayBoard> {
    const query = `
      mutation CreateBoard($name: String!, $kind: BoardKind!, $workspaceId: ID!) {
        create_board(name: $name, kind: $kind, workspace_id: $workspaceId) {
          id
          name
          state
          workspace {
            id
            name
          }
        }
      }
    `

    const result = await this.query<{ create_board: MondayBoard }>(query, {
      name,
      kind,
      workspaceId,
    })

    return result.create_board
  }

  async archiveBoard(boardId: string): Promise<boolean> {
    const query = `
      mutation ArchiveBoard($boardId: ID!) {
        archive_board(board_id: $boardId) {
          id
          state
        }
      }
    `

    const result = await this.query<{ archive_board: { id: string, state: string } }>(query, {
      boardId,
    })

    return result.archive_board.state === 'archived'
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

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

// Helper function for quick testing
export async function quickDiscovery(): Promise<OrganizationalStructure> {
  return await mondayApi.discoverOrganization({
    includeArchived: false,
    includeItems: false,
    maxBoards: 50, // Limit for quick testing
  })
}

// Helper function to test API connection
export async function testMondayConnection(): Promise<boolean> {
  return await mondayApi.testConnection()
}
