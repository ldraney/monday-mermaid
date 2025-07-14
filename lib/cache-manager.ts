// lib/cache-manager.ts
// FOCUSED data synchronization for priority workspaces only

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
import { config, getPriorityWorkspaceNames } from './config'
import type { 
  OrganizationalStructure, 
  MondayBoard, 
  DiscoveryOptions,
  SyncOptions 
} from './types'

export class CacheManager {
  private issyncing = false

  // =============================================================================
  // PRIORITY WORKSPACE FOCUSED SYNC OPERATIONS
  // =============================================================================

  async priorityWorkspaceSync(options: SyncOptions = {}): Promise<OrganizationalStructure> {
    if (this.issyncing) {
      throw new Error('Sync already in progress')
    }

    this.issyncing = true
    const syncId = await startSync('priority_workspace_sync')
    
    try {
      console.log('🎯 Starting FOCUSED priority workspace sync...')
      const startTime = Date.now()
      const priorityNames = getPriorityWorkspaceNames()

      console.log(`🔍 Targeting workspaces: ${priorityNames.join(', ')}`)

      // Verify connections
      const [mondayConnected, dbConnected] = await Promise.all([
        mondayApi.testConnection(),
        testDatabaseConnection(),
      ])

      if (!mondayConnected) throw new Error('Monday.com API connection failed')
      if (!dbConnected) throw new Error('Database connection failed')

      // Use focused discovery for priority workspaces only
      const discoveryOptions: DiscoveryOptions = {
        includeArchived: options.includeArchived ?? false,
        includeItems: true,
        maxBoards: config.priorityWorkspaces.displaySettings.maxBoardsPerWorkspace,
      }

      console.log('📊 Discovering priority workspace organization...')
      const orgData = await mondayApi.discoverPriorityWorkspaces(discoveryOptions)
      
      if (orgData.workspaces.length === 0) {
        throw new Error(`No priority workspaces found. Expected: ${priorityNames.join(', ')}`)
      }

      console.log(`✅ Found ${orgData.workspaces.length}/${priorityNames.length} priority workspaces`)
      
      // Cache workspaces (only priority ones)
      await saveWorkspaces(orgData.workspaces)
      
      // Cache boards and their columns
      let boardsProcessed = 0
      for (const board of orgData.boards) {
        await saveBoards([board])
        await saveColumns(board.id, board.columns)
        boardsProcessed++
        
        if (boardsProcessed % 5 === 0) {
          console.log(`📋 Processed ${boardsProcessed}/${orgData.boards.length} priority workspace boards`)
        }
      }

      // Cache users
      await saveUsers(orgData.users)

      // Discover and cache board relationships WITHIN priority workspaces
      await this.syncPriorityBoardRelationships(orgData.boards)

      // Complete sync tracking
      await completeSync(syncId, {
        processed: orgData.workspaces.length + orgData.boards.length + orgData.users.length,
        created: orgData.boards.length,
        updated: 0,
        deleted: 0,
      })

      const duration = Date.now() - startTime
      console.log(`✅ Priority workspace sync completed in ${duration}ms`)
      console.log(`📊 Cached: ${orgData.workspaces.length} workspaces, ${orgData.boards.length} boards, ${orgData.users.length} users`)

      // Return the focused organizational structure
      return await getOrganizationalStructure()
      
    } catch (error) {
      await failSync(syncId, error instanceof Error ? error.message : 'Unknown error')
      console.error('❌ Priority workspace sync failed:', error)
      throw error
    } finally {
      this.issyncing = false
    }
  }

  // For backward compatibility, map full sync to priority sync
  async fullSync(options: SyncOptions = {}): Promise<OrganizationalStructure> {
    console.log('🔄 Full sync requested - using focused priority workspace sync instead')
    return this.priorityWorkspaceSync({ ...options, forceRefresh: true })
  }

  async incrementalSync(options: SyncOptions = {}): Promise<OrganizationalStructure> {
    if (this.issyncing) {
      throw new Error('Sync already in progress')
    }

    this.issyncing = true
    const syncId = await startSync('incremental_priority_sync')

    try {
      console.log('⚡ Starting incremental priority workspace sync...')
      const startTime = Date.now()

      // Get current priority workspaces from Monday.com
      const priorityWorkspaces = await mondayApi.getPriorityWorkspaces()
      
      if (priorityWorkspaces.length === 0) {
        throw new Error('No priority workspaces found for incremental sync')
      }

      // Update only active boards from priority workspaces
      const updatedBoards: MondayBoard[] = []
      
      for (const workspace of priorityWorkspaces) {
        const workspaceBoards = await mondayApi.getBoardsInWorkspace(workspace.id, {
          includeArchived: false,
          maxBoards: config.priorityWorkspaces.displaySettings.maxBoardsPerWorkspace,
        })
        
        for (const board of workspaceBoards.filter(b => b.state === 'active')) {
          await saveBoards([board])
          await saveColumns(board.id, board.columns)
          updatedBoards.push(board)
        }
      }

      await completeSync(syncId, {
        processed: updatedBoards.length,
        created: 0,
        updated: updatedBoards.length,
        deleted: 0,
      })

      const duration = Date.now() - startTime
      console.log(`⚡ Incremental priority sync completed in ${duration}ms`)
      console.log(`📊 Updated: ${updatedBoards.length} active boards`)

      return await getOrganizationalStructure()

    } catch (error) {
      await failSync(syncId, error instanceof Error ? error.message : 'Unknown error')
      console.error('❌ Incremental priority sync failed:', error)
      throw error
    } finally {
      this.issyncing = false
    }
  }

  // =============================================================================
  // PRIORITY WORKSPACE RELATIONSHIP DISCOVERY
  // =============================================================================

  private async syncPriorityBoardRelationships(boards: MondayBoard[]): Promise<void> {
    console.log('🕸️ Discovering relationships within priority workspaces...')
    let relationshipsFound = 0

    for (const board of boards) {
      try {
        // Get connections for this board
        const connections = await mondayApi.getBoardConnections(board.id)
        
        for (const connection of connections) {
          // Only save relationships that target boards we actually have (priority workspace boards)
          const targetBoardExists = boards.some(b => b.id === connection.targetBoard)
          
          if (targetBoardExists) {
            await saveBoardRelationship({
              sourceBoard: board.id,
              targetBoard: connection.targetBoard,
              type: connection.type || 'connect',
              sourceColumn: connection.columnId,
              metadata: {
                columnTitle: connection.columnTitle,
                connectionDetails: connection.connectionDetails,
                discoveredAt: new Date().toISOString(),
              },
            })
            relationshipsFound++
            
            console.log(`🔗 Found connection: ${board.name} → ${connection.targetBoard} (${connection.type})`)
          } else {
            console.log(`⚠️ Skipping external connection from ${board.name} to board ${connection.targetBoard} (outside priority workspaces)`)
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to get relationships for board ${board.name}:`, error)
      }
    }

    console.log(`🕸️ Found ${relationshipsFound} relationships within priority workspaces`)
  }

  // =============================================================================
  // PRIORITY WORKSPACE SPECIFIC METHODS
  // =============================================================================

  async syncSpecificPriorityWorkspace(workspaceName: string): Promise<void> {
    const priorityNames = getPriorityWorkspaceNames()
    
    if (!priorityNames.includes(workspaceName)) {
      throw new Error(`"${workspaceName}" is not a priority workspace. Priority workspaces: ${priorityNames.join(', ')}`)
    }

    if (this.issyncing) {
      throw new Error('Sync already in progress')
    }

    const syncId = await startSync('specific_priority_workspace_sync', workspaceName)
    
    try {
      console.log(`🎯 Syncing specific priority workspace: ${workspaceName}`)
      
      // Find the workspace by name
      const allWorkspaces = await mondayApi.getWorkspaces()
      const targetWorkspace = allWorkspaces.find(w => w.name === workspaceName)
      
      if (!targetWorkspace) {
        throw new Error(`Priority workspace "${workspaceName}" not found in Monday.com`)
      }

      // Get boards for specific workspace
      const boards = await mondayApi.getBoardsInWorkspace(targetWorkspace.id, {
        includeArchived: config.priorityWorkspaces.boardFilters.includeArchived,
        maxBoards: config.priorityWorkspaces.displaySettings.maxBoardsPerWorkspace,
      })
      
      // Save workspace and boards
      await saveWorkspaces([targetWorkspace])
      
      for (const board of boards) {
        await saveBoards([board])
        await saveColumns(board.id, board.columns)
      }

      await completeSync(syncId, {
        processed: boards.length + 1,
        created: 0,
        updated: boards.length + 1,
        deleted: 0,
      })

      console.log(`✅ Priority workspace "${workspaceName}" synced: ${boards.length} boards`)
      
    } catch (error) {
      await failSync(syncId, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  async validatePriorityWorkspaceSetup(): Promise<{
    isValid: boolean
    foundWorkspaces: string[]
    missingWorkspaces: string[]
    issues: string[]
    recommendations: string[]
  }> {
    try {
      const validation = await mondayApi.validatePriorityWorkspaceSetup()
      const priorityNames = getPriorityWorkspaceNames()
      
      const allWorkspaces = await mondayApi.getWorkspaces()
      const foundWorkspaces = allWorkspaces
        .filter(w => priorityNames.includes(w.name))
        .map(w => w.name)
      
      const missingWorkspaces = priorityNames.filter(name => !foundWorkspaces.includes(name))
      
      return {
        isValid: validation.isValid && missingWorkspaces.length === 0,
        foundWorkspaces,
        missingWorkspaces,
        issues: validation.issues,
        recommendations: validation.recommendations
      }
    } catch (error) {
      return {
        isValid: false,
        foundWorkspaces: [],
        missingWorkspaces: getPriorityWorkspaceNames(),
        issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ['Check Monday.com API connectivity and workspace access']
      }
    }
  }

  // =============================================================================
  // SMART SYNC STRATEGY (priority workspace focused)
  // =============================================================================

  async smartSync(): Promise<OrganizationalStructure> {
    const status = await this.getCacheStatus()
    
    if (!status.isHealthy || status.cacheAge > 48) {
      // Priority sync if cache is unhealthy or very old
      console.log('🎯 Performing priority workspace sync (cache unhealthy or very old)')
      return await this.priorityWorkspaceSync()
    } else if (status.needsRefresh) {
      // Incremental sync if cache needs refresh
      console.log('⚡ Performing incremental priority sync (cache needs refresh)')
      return await this.incrementalSync()
    } else {
      // Return cached data if fresh
      console.log('✅ Using cached priority workspace data (fresh)')
      return await getOrganizationalStructure()
    }
  }

  // =============================================================================
  // CACHE STATUS AND MANAGEMENT (unchanged)
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
      console.log(`🔄 Cache is ${status.cacheAge.toFixed(1)} hours old, refreshing priority workspaces...`)
      return await this.incrementalSync()
    } else {
      console.log(`✅ Priority workspace cache is fresh (${status.cacheAge.toFixed(1)} hours old)`)
      return null
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
      const priorityNames = getPriorityWorkspaceNames()
      
      // Check if we have all priority workspaces
      const foundWorkspaceNames = orgData.workspaces.map(w => w.name)
      const missingPriorityWorkspaces = priorityNames.filter(name => 
        !foundWorkspaceNames.includes(name)
      )
      
      if (missingPriorityWorkspaces.length > 0) {
        issues.push(`Missing priority workspaces: ${missingPriorityWorkspaces.join(', ')}`)
      }

      // Check for orphaned boards (boards without workspaces)
      const orphanedBoards = orgData.boards.filter(board => !board.workspace)
      if (orphanedBoards.length > 0) {
        issues.push(`${orphanedBoards.length} boards without workspace references`)
      }

      // Check cache age
      const cacheAge = (Date.now() - orgData.lastScanned.getTime()) / (1000 * 60 * 60)
      if (cacheAge > config.database.defaultTtlHours * 2) {
        issues.push(`Cache is very old (${cacheAge.toFixed(1)} hours)`)
      }

      return {
        isValid: issues.length === 0,
        issues,
      }
      
    } catch (error) {
      return {
        isValid: false,
        issues: [`Cache validation failed: ${error}`],
      }
    }
  }

  async clearCache(): Promise<void> {
    console.log('🗑️ Clearing priority workspace cache...')
    // This would delete cached data for priority workspaces
    // For now, just log the intention
    console.log('Cache clear not implemented (safety measure)')
  }

  // Legacy method mapping
  async syncSpecificWorkspace(workspaceId: string): Promise<void> {
    // Convert workspace ID to name and use priority workspace sync
    const orgData = await getOrganizationalStructure()
    const workspace = orgData.workspaces.find(w => w.id === workspaceId)
    
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`)
    }
    
    return this.syncSpecificPriorityWorkspace(workspace.name)
  }
}

// =============================================================================
// EXPORT DEFAULT INSTANCE
// =============================================================================

export const cacheManager = new CacheManager()

// =============================================================================
// CONVENIENCE FUNCTIONS (updated for priority workspace focus)
// =============================================================================

export async function ensureFreshData(): Promise<OrganizationalStructure> {
  return await cacheManager.smartSync()
}

export async function quickSync(): Promise<OrganizationalStructure> {
  const status = await cacheManager.getCacheStatus()
  
  if (!status.isHealthy) {
    return await cacheManager.priorityWorkspaceSync()
  } else {
    return await getOrganizationalStructure()
  }
}

export async function forceRefresh(): Promise<OrganizationalStructure> {
  return await cacheManager.priorityWorkspaceSync({ forceRefresh: true })
}

export async function validatePriorityWorkspaces() {
  return await cacheManager.validatePriorityWorkspaceSetup()
}
