// lib/types.ts
// TypeScript interfaces for Monday.com API and monday-mermaid system

// =============================================================================
// MONDAY.COM API TYPES
// =============================================================================

export interface MondayWorkspace {
  id: string
  name: string
  kind: string
  description?: string
  settings?: {
    product_kind: string
  }
}

export interface MondayBoard {
  id: string
  name: string
  description?: string
  state: 'active' | 'archived' | 'deleted'
  board_folder_id?: string
  board_kind: string
  workspace?: {
    id: string
    name: string
  }
  columns: MondayColumn[]
  items_count?: number
  permissions?: string
  tags?: MondayTag[]
  updated_at?: string
}

export interface MondayColumn {
  id: string
  title: string
  type: string
  settings_str?: string
  archived?: boolean
  pos?: string
}

export interface MondayTag {
  id: string
  name: string
  color: string
}

export interface MondayUser {
  id: string
  name: string
  email: string
  enabled: boolean
  is_admin: boolean
  is_guest: boolean
  last_activity?: string
}

// Monday.com API Response wrapper
export interface MondayApiResponse<T> {
  data: T
  errors?: Array<{
    message: string
    locations?: Array<{
      line: number
      column: number
    }>
    path?: string[]
  }>
  account_id?: number
}

// =============================================================================
// MONDAY-MERMAID INTERNAL TYPES  
// =============================================================================

export interface OrganizationalStructure {
  workspaces: MondayWorkspace[]
  boards: MondayBoard[]
  relationships: BoardRelationship[]
  healthMetrics: HealthMetrics
  users: MondayUser[]
  lastScanned: Date
}

export interface BoardRelationship {
  sourceBoard: MondayBoard
  targetBoard: MondayBoard
  type: 'dependency' | 'mirror' | 'connect' | 'integration'
  columns?: {
    source: MondayColumn
    target: MondayColumn
  }[]
}

export interface HealthMetrics {
  totalWorkspaces: number
  totalBoards: number
  activeBoards: number
  archivedBoards: number
  totalItems: number
  inactiveBoards: MondayBoard[]
  underutilizedBoards: MondayBoard[]
  lastUpdated: Date
  activitySummary: {
    daily: number
    weekly: number
    monthly: number
  }
}

export interface BoardHealth {
  board: MondayBoard
  status: 'healthy' | 'warning' | 'inactive' | 'abandoned'
  lastActivity?: Date
  itemsCount: number
  collaboratorsCount: number
  issues: string[]
  recommendations: string[]
}

export interface WorkspaceHealth {
  workspace: MondayWorkspace
  boardsHealthy: number
  boardsWarning: number
  boardsInactive: number
  totalBoards: number
  overallScore: number
  recommendations: string[]
}

// =============================================================================
// MERMAID DIAGRAM TYPES
// =============================================================================

export interface MermaidDiagramConfig {
  type: 'organization' | 'relationships' | 'health' | 'workspace'
  title: string
  data: OrganizationalStructure | MondayWorkspace | BoardRelationship[]
  options?: {
    showInactive?: boolean
    colorByHealth?: boolean
    maxDepth?: number
    workspaceFilter?: string[]
  }
}

export interface MermaidNode {
  id: string
  label: string
  type: 'workspace' | 'board' | 'column' | 'relationship'
  status?: 'healthy' | 'warning' | 'inactive' | 'abandoned'
  metadata?: Record<string, any>
}

export interface MermaidEdge {
  from: string
  to: string
  type: 'contains' | 'dependency' | 'mirror' | 'connect'
  label?: string
}

// =============================================================================
// DATABASE CACHE TYPES (for future PostgreSQL integration)
// =============================================================================

export interface CachedWorkspace extends MondayWorkspace {
  cached_at: Date
  last_synced: Date
}

export interface CachedBoard extends MondayBoard {
  workspace_id?: string
  cached_at: Date
  last_synced: Date
}

export interface CachedBoardRelationship extends BoardRelationship {
  id: string
  source_board_id: string
  target_board_id: string
  created_at: Date
  last_verified: Date
}

// =============================================================================
// API CONFIGURATION TYPES
// =============================================================================

export interface DiscoveryOptions {
  includeArchived?: boolean
  includeItems?: boolean
  includeActivityLogs?: boolean
  workspaceFilter?: string[]
  maxBoards?: number
  cacheTtlHours?: number
}

export interface SyncOptions {
  forceRefresh?: boolean
  workspacesOnly?: boolean
  boardsOnly?: boolean
  incrementalSync?: boolean
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ApiState<T> {
  data: T | null
  status: ApiStatus
  error: string | null
  lastFetched?: Date
}

export interface DashboardState {
  organizationData: ApiState<OrganizationalStructure>
  selectedWorkspace: MondayWorkspace | null
  selectedBoard: MondayBoard | null
  viewMode: 'organization' | 'workspace' | 'board' | 'health'
  showInactive: boolean
}

// =============================================================================
// EXPORT HELPERS
// =============================================================================

// Type guards
export function isMondayWorkspace(obj: any): obj is MondayWorkspace {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string' && typeof obj.kind === 'string'
}

export function isMondayBoard(obj: any): obj is MondayBoard {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string' && Array.isArray(obj.columns)
}

export function isHealthyBoard(health: BoardHealth): boolean {
  return health.status === 'healthy'
}

// Constants
export const BOARD_STATES = ['active', 'archived', 'deleted'] as const
export const HEALTH_STATUSES = ['healthy', 'warning', 'inactive', 'abandoned'] as const
export const RELATIONSHIP_TYPES = ['dependency', 'mirror', 'connect', 'integration'] as const
export const MERMAID_DIAGRAM_TYPES = ['organization', 'relationships', 'health', 'workspace'] as const
