// lib/database.ts
// PostgreSQL client and database operations for monday-mermaid

import postgres from 'postgres'
import { config } from './config'
import type { 
  MondayWorkspace, 
  MondayBoard, 
  MondayColumn, 
  MondayUser,
  OrganizationalStructure,
  BoardRelationship,
  HealthMetrics,
  CachedWorkspace,
  CachedBoard 
} from './types'

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

export const sql = postgres(config.database.url, {
  max: config.database.poolSize,
  connect_timeout: config.database.connectionTimeoutMs / 1000,
  idle_timeout: 20,
  max_lifetime: 60 * 30, // 30 minutes
})

// =============================================================================
// DATABASE UTILITIES
// =============================================================================

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1 as test`
    console.log('✅ PostgreSQL connection successful')
    return true
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error)
    return false
  }
}

export async function initializeDatabase(): Promise<void> {
  try {
    // Check if tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('workspaces', 'boards', 'columns')
    `
    
    if (tables.length < 3) {
      throw new Error('Database schema not found. Please run the schema.sql file.')
    }
    
    console.log('✅ Database schema verified')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  }
}

// =============================================================================
// WORKSPACE OPERATIONS
// =============================================================================

export async function saveWorkspaces(workspaces: MondayWorkspace[]): Promise<void> {
  if (workspaces.length === 0) return

  const values = workspaces.map(workspace => ({
    id: workspace.id,
    name: workspace.name,
    kind: workspace.kind,
    description: workspace.description || null,
    product_kind: workspace.settings?.product_kind || null,
  }))

  await sql`
    INSERT INTO workspaces ${sql(values)}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      kind = EXCLUDED.kind,
      description = EXCLUDED.description,
      product_kind = EXCLUDED.product_kind,
      last_synced = CURRENT_TIMESTAMP
  `

  console.log(`💾 Saved ${workspaces.length} workspaces`)
}

export async function getWorkspaces(): Promise<CachedWorkspace[]> {
  const workspaces = await sql`
    SELECT id, name, kind, description, product_kind, cached_at, last_synced
    FROM workspaces
    ORDER BY name
  `

  return workspaces.map(w => ({
    id: w.id,
    name: w.name,
    kind: w.kind,
    description: w.description,
    settings: w.product_kind ? { product_kind: w.product_kind } : undefined,
    cached_at: w.cached_at,
    last_synced: w.last_synced,
  }))
}

// =============================================================================
// BOARD OPERATIONS
// =============================================================================

export async function saveBoards(boards: MondayBoard[]): Promise<void> {
  if (boards.length === 0) return

  const values = boards.map(board => ({
    id: board.id,
    workspace_id: board.workspace?.id || null,
    name: board.name,
    description: board.description || null,
    state: board.state,
    board_folder_id: board.board_folder_id || null,
    board_kind: board.board_kind,
    items_count: board.items_count || 0,
    permissions: board.permissions || null,
    updated_at: board.updated_at ? new Date(board.updated_at) : null,
  }))

  await sql`
    INSERT INTO boards ${sql(values)}
    ON CONFLICT (id) DO UPDATE SET
      workspace_id = EXCLUDED.workspace_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      state = EXCLUDED.state,
      board_folder_id = EXCLUDED.board_folder_id,
      board_kind = EXCLUDED.board_kind,
      items_count = EXCLUDED.items_count,
      permissions = EXCLUDED.permissions,
      updated_at = EXCLUDED.updated_at,
      last_synced = CURRENT_TIMESTAMP
  `

  console.log(`💾 Saved ${boards.length} boards`)
}

export async function getBoards(workspaceId?: string): Promise<CachedBoard[]> {
  const whereClause = workspaceId ? sql`WHERE workspace_id = ${workspaceId}` : sql``
  
  const boards = await sql`
    SELECT 
      b.id, b.workspace_id, b.name, b.description, b.state,
      b.board_folder_id, b.board_kind, b.items_count, b.permissions,
      b.updated_at, b.cached_at, b.last_synced, b.health_status, b.health_score,
      w.name as workspace_name
    FROM boards b
    LEFT JOIN workspaces w ON b.workspace_id = w.id
    ${whereClause}
    ORDER BY b.name
  `

  return boards.map(b => ({
    id: b.id,
    name: b.name,
    description: b.description,
    state: b.state,
    board_folder_id: b.board_folder_id,
    board_kind: b.board_kind,
    workspace: b.workspace_id ? {
      id: b.workspace_id,
      name: b.workspace_name || 'Unknown Workspace'
    } : undefined,
    columns: [], // Will be populated by getColumnsForBoard if needed
    items_count: b.items_count,
    permissions: b.permissions,
    updated_at: b.updated_at?.toISOString(),
    workspace_id: b.workspace_id,
    cached_at: b.cached_at,
    last_synced: b.last_synced,
  }))
}

export async function getBoardById(boardId: string): Promise<CachedBoard | null> {
  const boards = await sql`
    SELECT 
      b.id, b.workspace_id, b.name, b.description, b.state,
      b.board_folder_id, b.board_kind, b.items_count, b.permissions,
      b.updated_at, b.cached_at, b.last_synced, b.health_status, b.health_score,
      w.name as workspace_name
    FROM boards b
    LEFT JOIN workspaces w ON b.workspace_id = w.id
    WHERE b.id = ${boardId}
  `

  if (boards.length === 0) return null

  const b = boards[0]
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    state: b.state,
    board_folder_id: b.board_folder_id,
    board_kind: b.board_kind,
    workspace: b.workspace_id ? {
      id: b.workspace_id,
      name: b.workspace_name || 'Unknown Workspace'
    } : undefined,
    columns: [], // Will be populated separately if needed
    items_count: b.items_count,
    permissions: b.permissions,
    updated_at: b.updated_at?.toISOString(),
    workspace_id: b.workspace_id,
    cached_at: b.cached_at,
    last_synced: b.last_synced,
  }
}

// =============================================================================
// COLUMN OPERATIONS
// =============================================================================

export async function saveColumns(boardId: string, columns: MondayColumn[]): Promise<void> {
  if (columns.length === 0) return

  // First, delete existing columns for this board
  await sql`DELETE FROM columns WHERE board_id = ${boardId}`

  const values = columns.map(column => ({
    id: column.id,
    board_id: boardId,
    title: column.title,
    type: column.type,
    settings_str: column.settings_str || null,
    archived: column.archived || false,
    position: column.pos || null,
  }))

  await sql`INSERT INTO columns ${sql(values)}`

  console.log(`💾 Saved ${columns.length} columns for board ${boardId}`)
}

export async function getColumnsForBoard(boardId: string): Promise<MondayColumn[]> {
  const columns = await sql`
    SELECT id, title, type, settings_str, archived, position as pos
    FROM columns
    WHERE board_id = ${boardId}
    ORDER BY position
  `

  return columns.map(c => ({
    id: c.id,
    title: c.title,
    type: c.type,
    settings_str: c.settings_str,
    archived: c.archived,
    pos: c.pos,
  }))
}

// =============================================================================
// BOARD RELATIONSHIPS
// =============================================================================

export async function saveBoardRelationship(relationship: {
  sourceBoard: string
  targetBoard: string
  type: string
  sourceColumn?: string
  targetColumn?: string
  metadata?: any
}): Promise<void> {
  await sql`
    INSERT INTO board_relationships (
      source_board_id, target_board_id, relationship_type,
      source_column_id, target_column_id, metadata
    ) VALUES (
      ${relationship.sourceBoard}, ${relationship.targetBoard}, ${relationship.type},
      ${relationship.sourceColumn || null}, ${relationship.targetColumn || null}, 
      ${JSON.stringify(relationship.metadata || {})}
    )
    ON CONFLICT (source_board_id, target_board_id, relationship_type, source_column_id) 
    DO UPDATE SET
      target_column_id = EXCLUDED.target_column_id,
      metadata = EXCLUDED.metadata,
      last_verified = CURRENT_TIMESTAMP
  `
}

export async function getBoardRelationships(boardId?: string): Promise<BoardRelationship[]> {
  const whereClause = boardId 
    ? sql`WHERE source_board_id = ${boardId} OR target_board_id = ${boardId}`
    : sql``

  const relationships = await sql`
    SELECT 
      br.source_board_id, br.target_board_id, br.relationship_type,
      br.source_column_id, br.target_column_id, br.metadata,
      sb.name as source_board_name, tb.name as target_board_name
    FROM board_relationships br
    JOIN boards sb ON br.source_board_id = sb.id
    JOIN boards tb ON br.target_board_id = tb.id
    ${whereClause}
    WHERE br.is_active = true
  `

  // Note: This returns a simplified version - full BoardRelationship would need more data
  return relationships.map(r => ({
    sourceBoard: { id: r.source_board_id, name: r.source_board_name } as MondayBoard,
    targetBoard: { id: r.target_board_id, name: r.target_board_name } as MondayBoard,
    type: r.relationship_type as any,
    columns: r.source_column_id ? [{
      source: { id: r.source_column_id } as MondayColumn,
      target: { id: r.target_column_id } as MondayColumn,
    }] : undefined,
  }))
}

// =============================================================================
// USERS
// =============================================================================

export async function saveUsers(users: MondayUser[]): Promise<void> {
  if (users.length === 0) return

  const values = users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email || null,
    enabled: user.enabled,
    is_admin: user.is_admin,
    is_guest: user.is_guest,
    last_activity: user.last_activity ? new Date(user.last_activity) : null,
  }))

  await sql`
    INSERT INTO users ${sql(values)}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      enabled = EXCLUDED.enabled,
      is_admin = EXCLUDED.is_admin,
      is_guest = EXCLUDED.is_guest,
      last_activity = EXCLUDED.last_activity,
      last_synced = CURRENT_TIMESTAMP
  `

  console.log(`💾 Saved ${users.length} users`)
}

// =============================================================================
// ORGANIZATIONAL QUERIES
// =============================================================================

export async function getOrganizationOverview(): Promise<{
  totalWorkspaces: number
  totalBoards: number
  activeBoards: number
  archivedBoards: number
  totalItems: number
  totalUsers: number
  lastSyncTime: Date | null
}> {
  const result = await sql`
    SELECT 
      COUNT(DISTINCT w.id)::int as total_workspaces,
      COUNT(DISTINCT b.id)::int as total_boards,
      COUNT(DISTINCT CASE WHEN b.state = 'active' THEN b.id END)::int as active_boards,
      COUNT(DISTINCT CASE WHEN b.state = 'archived' THEN b.id END)::int as archived_boards,
      COALESCE(SUM(b.items_count), 0)::int as total_items,
      COUNT(DISTINCT u.id)::int as total_users,
      MAX(b.last_synced) as last_sync_time
    FROM workspaces w
    LEFT JOIN boards b ON w.id = b.workspace_id
    LEFT JOIN users u ON TRUE
  `

  const row = result[0]
  return {
    totalWorkspaces: row.total_workspaces,
    totalBoards: row.total_boards,
    activeBoards: row.active_boards,
    archivedBoards: row.archived_boards,
    totalItems: row.total_items,
    totalUsers: row.total_users,
    lastSyncTime: row.last_sync_time,
  }
}

export async function getOrganizationalStructure(): Promise<OrganizationalStructure> {
  const [workspaces, boards, relationships, users, overview] = await Promise.all([
    getWorkspaces(),
    getBoards(),
    getBoardRelationships(),
    sql`SELECT * FROM users`,
    getOrganizationOverview(),
  ])

  const healthMetrics: HealthMetrics = {
    totalWorkspaces: overview.totalWorkspaces,
    totalBoards: overview.totalBoards,
    activeBoards: overview.activeBoards,
    archivedBoards: overview.archivedBoards,
    totalItems: overview.totalItems,
    inactiveBoards: [], // Will be calculated by health analyzer
    underutilizedBoards: [], // Will be calculated by health analyzer
    lastUpdated: new Date(),
    activitySummary: {
      daily: 0,
      weekly: 0, 
      monthly: 0,
    },
  }

  return {
    workspaces,
    boards,
    relationships,
    healthMetrics,
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      enabled: u.enabled,
      is_admin: u.is_admin,
      is_guest: u.is_guest,
      last_activity: u.last_activity?.toISOString(),
    })),
    lastScanned: overview.lastSyncTime || new Date(),
  }
}

// =============================================================================
// SYNC OPERATIONS
// =============================================================================

export async function startSync(type: string, workspaceId?: string): Promise<string> {
  const result = await sql`
    INSERT INTO sync_metadata (sync_type, workspace_id, status)
    VALUES (${type}, ${workspaceId || null}, 'running')
    RETURNING id
  `

  return result[0].id
}

export async function completeSync(syncId: string, stats: {
  processed: number
  created: number
  updated: number
  deleted: number
}): Promise<void> {
  await sql`
    UPDATE sync_metadata SET
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP,
      records_processed = ${stats.processed},
      records_created = ${stats.created},
      records_updated = ${stats.updated},
      records_deleted = ${stats.deleted}
    WHERE id = ${syncId}
  `
}

export async function failSync(syncId: string, error: string): Promise<void> {
  await sql`
    UPDATE sync_metadata SET
      status = 'failed',
      completed_at = CURRENT_TIMESTAMP,
      error_message = ${error}
    WHERE id = ${syncId}
  `
}

// =============================================================================
// CLEANUP AND MAINTENANCE
// =============================================================================

export async function cleanup(): Promise<void> {
  // Clean up old sync records (keep last 100)
  await sql`
    DELETE FROM sync_metadata 
    WHERE id NOT IN (
      SELECT id FROM sync_metadata 
      ORDER BY started_at DESC 
      LIMIT 100
    )
  `

  // Clean up old health metrics (keep last 30 days)
  await sql`
    DELETE FROM health_metrics 
    WHERE calculated_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
  `

  console.log('🧹 Database cleanup completed')
}

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  await sql.end()
  console.log('🔌 Database connection closed')
}
