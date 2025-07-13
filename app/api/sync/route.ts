// app/api/sync/route.ts
// API endpoint for syncing Monday.com data

import { NextRequest, NextResponse } from 'next/server'
import { cacheManager } from '@/lib/cache-manager'
import { initializeDatabase } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    // Initialize database connection
    await initializeDatabase()
    
    // Parse request body for sync options
    const body = await request.json().catch(() => ({}))
    const { type = 'smart', forceRefresh = false, workspaceId } = body

    console.log(`🔄 Starting ${type} sync${workspaceId ? ` for workspace ${workspaceId}` : ''}...`)

    let orgData
    
    switch (type) {
      case 'full':
        orgData = await cacheManager.fullSync({ forceRefresh })
        break
      case 'incremental':
        orgData = await cacheManager.incrementalSync()
        break
      case 'workspace':
        if (!workspaceId) {
          return NextResponse.json(
            { error: 'Workspace ID required for workspace sync' },
            { status: 400 }
          )
        }
        await cacheManager.syncSpecificWorkspace(workspaceId)
        orgData = await cacheManager.smartSync()
        break
      case 'smart':
      default:
        orgData = await cacheManager.smartSync()
        break
    }

    return NextResponse.json({
      success: true,
      syncType: type,
      timestamp: new Date().toISOString(),
      data: orgData,
      stats: {
        workspaces: orgData.healthMetrics.totalWorkspaces,
        boards: orgData.healthMetrics.totalBoards,
        activeBoards: orgData.healthMetrics.activeBoards,
        totalItems: orgData.healthMetrics.totalItems,
      }
    })

  } catch (error) {
    console.error('❌ Sync API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Sync failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get cache status
    const status = await cacheManager.getCacheStatus()
    
    return NextResponse.json({
      success: true,
      status,
      isSyncing: cacheManager.isSyncing
    })

  } catch (error) {
    console.error('❌ Sync status API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get sync status',
      },
      { status: 500 }
    )
  }
}
