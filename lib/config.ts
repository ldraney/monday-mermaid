// lib/config.ts
// Environment configuration and app settings for monday-mermaid

import { z } from 'zod'

// Environment variable schema validation
const envSchema = z.object({
  // Monday.com API Configuration
  MONDAY_API_KEY: z.string().min(1, 'Monday.com API key is required'),
  
  // Database Configuration  
  DATABASE_URL: z.string().url().optional(),
  
  // App Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Optional: Specific board/workspace for testing
  MONDAY_BOARD_ID: z.string().optional(),
  MONDAY_WORKSPACE_ID: z.string().optional(),
})

// Parse and validate environment variables
function parseEnv() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment configuration:')
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`)
      })
    }
    process.exit(1)
  }
}

// Export validated environment
export const env = parseEnv()

// App-level configuration
export const config = {
  // Monday.com API settings
  monday: {
    apiKey: env.MONDAY_API_KEY,
    apiUrl: 'https://api.monday.com/v2',
    version: '2024-01',
    
    // Rate limiting (Monday.com allows 10,000 requests per hour)
    rateLimits: {
      requestsPerHour: 10000,
      requestsPerMinute: 200,
      maxRetries: 3,
      retryDelayMs: 1000,
    },
    
    // Optional filters for development
    testWorkspaceId: env.MONDAY_WORKSPACE_ID,
    testBoardId: env.MONDAY_BOARD_ID,
  },

  // Database settings
  database: {
    url: env.DATABASE_URL || 'postgresql://localhost:5432/monday_mermaid',
    poolSize: 20,
    connectionTimeoutMs: 30000,
    
    // Cache settings
    defaultTtlHours: 24,
    healthMetricsTtlHours: 6,
  },

  // Mermaid diagram settings
  mermaid: {
    maxNodesPerDiagram: 100,
    defaultTheme: 'default',
    
    // Performance settings for large organizations
    enableCaching: true,
    maxDiagramDepth: 4,
  },

  // Health analysis settings
  health: {
    // Consider a board "inactive" if no updates in X days
    inactiveDaysThreshold: 30,
    
    // Consider a board "underutilized" if < X items
    underutilizedItemsThreshold: 5,
    
    // Minimum board age before health analysis (days)
    minBoardAgeForAnalysis: 7,
  },

  // App settings
  app: {
    name: 'Monday Mermaid',
    version: '1.0.0',
    environment: env.NODE_ENV,
    
    // Development settings
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    
    // Sync settings
    autoSyncIntervalHours: 6,
    enableIncrementalSync: true,
  },

  // 🎯 PRIORITY WORKSPACES - Define your focused workspaces here
  priorityWorkspaces: {
    // Define your 4 priority workspaces by name
    // The app will ONLY sync and show these workspaces
    workspaceNames: [
      'CRM',
      'Production 2025', 
      'Lab',
      'VRM - Purchasing'
    ],
    
    // Display configuration for priority workspaces
    displaySettings: {
      // Show board health indicators
      showHealthIndicators: true,
      
      // Show item counts on boards
      showItemCounts: true,
      
      // Show last activity dates
      showLastActivity: true,
      
      // Maximum boards to show per workspace (for performance)
      maxBoardsPerWorkspace: 12,
      
      // Color coding for board health
      healthColors: {
        healthy: '#10b981',    // Green
        warning: '#f59e0b',    // Amber  
        inactive: '#ef4444',   // Red
        abandoned: '#6b7280'   // Gray
      }
    },
    
    // Board filtering within priority workspaces
    boardFilters: {
      // Only show active boards by default
      includeArchived: false,
      
      // Minimum items to show a board (hide empty boards)
      minItemsToShow: 0,
      
      // Board types to exclude
      excludeBoardTypes: ['template']
    }
  }
} as const

// Type exports for use throughout the app
export type AppConfig = typeof config
export type MondayConfig = typeof config.monday
export type DatabaseConfig = typeof config.database
export type PriorityWorkspacesConfig = typeof config.priorityWorkspaces

// Helper functions
export function isDevelopment(): boolean {
  return config.app.isDevelopment
}

export function isProduction(): boolean {
  return config.app.isProduction
}

export function getPriorityWorkspaceNames(): string[] {
  return config.priorityWorkspaces.workspaceNames
}

export function isPriorityWorkspace(workspaceName: string): boolean {
  return config.priorityWorkspaces.workspaceNames.includes(workspaceName)
}

// Validation helpers
export function validateMondayApiKey(): boolean {
  return config.monday.apiKey.length > 10 // Basic validation
}

export function validateDatabaseConnection(): boolean {
  return config.database.url.includes('postgresql://')
}

// Debug helpers (only in development)
export function logConfig(): void {
  if (isDevelopment()) {
    console.log('🔧 Monday Mermaid Configuration:')
    console.log(`  Environment: ${config.app.environment}`)
    console.log(`  Monday API: ${config.monday.apiKey.slice(0, 10)}...`)
    console.log(`  Database: ${config.database.url.split('@')[1] || 'local'}`)
    console.log(`  Priority Workspaces: ${config.priorityWorkspaces.workspaceNames.join(', ')}`)
    console.log(`  Health Indicators: ${config.priorityWorkspaces.displaySettings.showHealthIndicators}`)
    console.log(`  Max Boards/Workspace: ${config.priorityWorkspaces.displaySettings.maxBoardsPerWorkspace}`)
  }
}
