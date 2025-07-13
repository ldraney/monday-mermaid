// lib/cache-manager.ts
// Data synchronization and cache management between Monday.com and PostgreSQL

import { mondayApi } from './monday-api'
import { 
  saveWorkspaces, 
  saveBoards, 
  saveColumns, 
  saveUsers,
  saveBoardRelationship,
  getOrganizationalStructure,
  startSync,
  completeSync,
  failSync,
  testDatabaseConnection
} from './database'
import { config } from './config'
import type { 
  OrganizationalStructure, 
  MondayBoard, 
  DiscoveryOptions,
  SyncOptions 
} from './types'

export class CacheManager {
  private issyncing = false

  // =============================================================================
  // MAIN SYNC OPERATIONS
  // =============================================================================

  async fullSync(options: SyncOptions = {}): Promise<OrganizationalStructure> {
    if (this.issyncing) {
      throw new Error('Sync already in progress')
    }

    this.issyncing = true
    const syncId = await startSync('full_sync')
    
    try {
      console.log('🔄 Starting full organizational sync...')
      const startTime = Date.now()

      // Verify connections
      const [mondayConnected, dbConnected] = await Promise.all([
        mondayApi.testConnection(),
        testDatabaseConnection(),
      ])

      if (!mondayConnected) throw new Error('Monday.com API connection failed')
      if (!dbConnected) throw new Error('Database connection failed')

      // Discover organizational structure from Monday.com
      const discoveryOptions: DiscoveryOptions = {
        includeArchived: options.includeArchived ?? false,
        includeItems: true,
        maxBoards: config.app.isDevelopment ? 50 : undefined, // Limit in development
      }

      const orgData = await mondayApi.discoverOrganization(discoveryOptions)
      
      // Cache workspaces
      await saveWorkspaces(orgData.workspaces)
      
      // Cache boards and their columns
      let boardsProcessed = 0
      for (const board of orgData.boards) {
        await saveBoards([board])
        await saveColumns(board.id, board.columns)
        boardsProcessed++
        
        if (boardsProcessed % 10 === 0) {
          console.log(`📋 Processed ${boardsProcessed}/${orgData.boards.length} boards`)
        }
      }

      // Cache users
      await saveUsers(orgData.users)

      // Discover and cache board relationships
      await this.syncBoardRelationships(orgData.boards)

      // Complete sync tracking
      await completeSync(syncId, {
        processed: orgData.workspaces.length + orgData.boards.length + orgData.users.length,
        created: orgData.boards.length,
        updated: 0,
        deleted: 0,
      })

      const duration = Date.now() - startTime
      console.log(`✅ Full sync completed in ${duration}ms`)
      console.log(`   Cached: ${orgData.workspaces.length} workspaces, ${orgData.boards.length} boards, ${orgData.users.length} users`)

      // Return the cached organizational structure
      return await getOrganizationalStructure()
      
    } catch (error) {
      await failSync(syncId, error instanceof Error ? error.message : 'Unknown error')
      console.error('❌ Full sync failed:', error)
      throw error
    } finally {
      this.issyncing = false
    }
  }

  async incrementalSync(options: SyncOptions = {}): Promise<OrganizationalStructure> {
    if (this.issyncing) {
      throw new Error('Sync already in progress')
    }

    this.issyncing = true
    const syncId = await startSync('incremental_sync')

    try {
      console.log('⚡ Starting incremental sync...')
      const startTime = Date.now()

      // For now, incremental sync is simplified - just update boards
      // In a full implementation, this would check timestamps and only update changed data
      
      const orgData = await mondayApi.discoverOrganization({
        includeArchived: false,
        maxBoards: 100, // Reasonable limit for incremental updates
      })

      // Update only active boards (simplified incremental logic)
      const activeBoards = orgData.boards.filter(board => board.state === 'active')
      
      for (const board of activeBoards) {
        await saveBoards([board])
        await saveColumns(board.id, board.columns)
      }

      await completeSync(syncId, {
        processed: activeBoards.length,
        created: 0,
        updated: activeBoards.length,
        deleted: 0,
      })

      const duration = Date.now() - startTime
      console.log(`⚡ Incremental sync completed in ${duration}ms`)
      console.log(`   Updated: ${activeBoards.length} active boards`)

      return await getOrganizationalStructure()

    } catch (error) {
      await failSync(syncId, error instanceof Error ? error.message : 'Unknown error')
      console.error('❌ Incremental sync failed:', error)
      throw error
    } finally {
      this.issyncing = false
    }
  }

  // =============================================================================
  // RELATIONSHIP DISCOVERY
  // =============================================================================

  private async syncBoardRelationships(boards: MondayBoard[]): Promise<void> {
    console.log('🕸️ Discovering board relationships...')
    let relationshipsFound = 0

    for (const board of boards) {
      try {
        // Get connections for this board
        const connections = await mondayApi.getBoardConnections(board.id)
        
        for (const connection of connections) {
          if (connection.targetBoards && Array.isArray(connection.targetBoards)) {
            for (const targetBoardId of connection.targetBoards) {
              await saveBoardRelationship({
                sourceBoard: board.id,
                targetBoard: targetBoardId,
                type: connection.type || 'connect',
                sourceColumn: connection.columnId,
                metadata: {
                  columnTitle: connection.columnTitle,
                  discoveredAt: new Date().toISOString(),
                },
              })
              relationshipsFound++
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to get relationships for board ${board.id}:`, error)
      }
    }

    console.log(`🕸️ Found ${relationshipsFound} board relationships`)
  }

  // =============================================================================
  // CACHE STATUS AND MANAGEMENT
  // =============================================================================

  async getCacheStatus(): Promise<{
    isHealthy: boolean
    lastSync: Date | null
    totalBoards: number
    totalWorkspaces: number
    cacheAge: number // hours
    needsRefresh: boolean
  }> {
    try {
      const orgData = await getOrganizationalStructure()
      const lastSync = orgData.lastScanned
      const cacheAge = lastSync ? (Date.now() - lastSync.getTime()) / (1000 * 60 * 60) : Infinity
      
      return {
        isHealthy: orgData.workspaces.length > 0 && orgData.boards.length > 0,
        lastSync,
        totalBoards: orgData.boards.length,
        totalWorkspaces: orgData.workspaces.length,
        cacheAge,
        needsRefresh: cacheAge > config.database.defaultTtlHours,
      }
    } catch (error) {
      return {
        isHealthy: false,
        lastSync: null,
        totalBoards: 0,
        totalWorkspaces: 0,
        cacheAge: Infinity,
        needsRefresh: true,
      }
    }
  }

  async refreshIfNeeded(): Promise<OrganizationalStructure | null> {
    const status = await this.getCacheStatus()
    
    if (status.needsRefresh) {
      console.log(`🔄 Cache is ${status.cacheAge.toFixed(1)} hours old, refreshing...`)
      return await this.incrementalSync()
    } else {
      console.log(`✅ Cache is fresh (${status.cacheAge.toFixed(1)} hours old)`)
      return null
    }
  }

  // =============================================================================
  // SYNC STRATEGIES
  // =============================================================================

  async smartSync(): Promise<OrganizationalStructure> {
    const status = await this.getCacheStatus()
    
    if (!status.isHealthy || status.cacheAge > 48) {
      // Full sync if cache is unhealthy or very old
      console.log('🔄 Performing full sync (cache unhealthy or very old)')
      return await this.fullSync()
    } else if (status.needsRefresh) {
      // Incremental sync if cache needs refresh
      console.log('⚡ Performing incremental sync (cache needs refresh)')
      return await this.incrementalSync()
    } else {
      // Return cached data if fresh
      console.log('✅ Using cached data (fresh)')
      return await getOrganizationalStructure()
    }
  }

  async syncSpecificWorkspace(workspaceId: string): Promise<void> {
    if (this.issyncing) {
      throw new Error('Sync already in progress')
    }

    const syncId = await startSync('workspace_sync', workspaceId)
    
    try {
      console.log(`🔄 Syncing workspace ${workspaceId}...`)
      
      // Get boards for specific workspace
      const boards = await mondayApi.getBoardsInWorkspace(workspaceId)
      
      // Save boards and columns
      for (const board of boards) {
        await saveBoards([board])
        await saveColumns(board.id, board.columns)
      }

      await completeSync(syncId, {
        processed: boards.length,
        created: 0,
        updated: boards.length,
        deleted: 0,
      })

      console.log(`✅ Workspace ${workspaceId} synced: ${boards.length} boards`)
      
    } catch (error) {
      await failSync(syncId, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  get isSyncing(): boolean {
    return this.issyncing
  }

  async validateCacheIntegrity(): Promise<{
    isValid: boolean
    issues: string[]
  }> {
    const issues: string[] = []
    
    try {
      const orgData = await getOrganizationalStructure()
      
      // Check for orphaned boards (boards without workspaces)
      const orphanedBoards = orgData.boards.filter(board => !board.workspace)
      if (orphanedBoards.length > 0) {
        issues.push(`${orphanedBoards.length} boards without workspace references`)
      }

      // Check for empty workspaces
      const emptyWorkspaces = orgData.workspaces.filter(workspace => 
        !orgData.boards.some(board => board.workspace?.id === workspace.id)
      )
      if (emptyWorkspaces.length > 0) {
        issues.push(`${emptyWorkspaces.length} workspaces with no boards`)
      }

      // Check cache age
      const cacheAge = (Date.now() - orgData.lastScanned.getTime())
