#!/usr/bin/env node
// scripts/sync-monday-data.js
// Manual script to sync Monday.com data via API endpoints

const http = require('http')

// Load environment variables
require('dotenv').config()

async function syncMondayData() {
  console.log('🔄 Monday.com Data Sync Script')
  console.log('================================')
  
  // Parse command line arguments
  const args = process.argv.slice(2)
  const syncType = args[0] || 'smart'
  const workspaceId = args.find(arg => arg.startsWith('--workspace='))?.split('=')[1]
  const forceRefresh = args.includes('--force')
  const dryRun = args.includes('--dry-run')
  
  // Show usage if help requested
  if (args.includes('--help') || args.includes('-h')) {
    showUsage()
    return
  }

  console.log(`📋 Sync Type: ${syncType}`)
  if (workspaceId) console.log(`🏢 Workspace: ${workspaceId}`)
  if (forceRefresh) console.log(`🔄 Force Refresh: enabled`)
  if (dryRun) console.log(`🧪 Dry Run: enabled (no changes will be made)`)
  console.log('')

  // Check if dev server is running
  const serverRunning = await checkServerRunning()
  if (!serverRunning) {
    console.error('❌ Next.js development server not running')
    console.log('💡 Start the server first: npm run dev')
    console.log('💡 Then run this script in another terminal')
    process.exit(1)
  }

  try {
    if (dryRun) {
      console.log('🧪 Dry run mode - checking current cache status...')
      
      // Get current sync status
      const status = await apiCall('GET', '/api/sync')
      console.log('📊 Current cache status:')
      console.log(`   Healthy: ${status.status.isHealthy}`)
      console.log(`   Last sync: ${status.status.lastSync ? new Date(status.status.lastSync).toLocaleString() : 'Never'}`)
      console.log(`   Cache age: ${status.status.cacheAge.toFixed(1)} hours`)
      console.log(`   Needs refresh: ${status.status.needsRefresh}`)
      console.log(`   Total boards: ${status.status.totalBoards}`)
      console.log(`   Total workspaces: ${status.status.totalWorkspaces}`)
      console.log(`\n🧪 Would run: ${syncType} sync`)
      if (workspaceId) console.log(`   Would sync workspace: ${workspaceId}`)
      return
    }

    // Perform sync via API
    console.log(`🔄 Starting ${syncType} sync via API...`)
    const startTime = Date.now()
    
    const syncBody = { type: syncType }
    if (forceRefresh) syncBody.forceRefresh = true
    if (workspaceId) syncBody.workspaceId = workspaceId
    
    const result = await apiCall('POST', '/api/sync', syncBody)
    
    if (!result.success) {
      throw new Error(result.error || 'Sync failed')
    }

    const duration = Date.now() - startTime
    
    // Show results
    console.log(`\n✅ Sync completed in ${(duration / 1000).toFixed(1)}s`)
    console.log('📊 Final results:')
    console.log(`   Workspaces: ${result.stats.workspaces}`)
    console.log(`   Total boards: ${result.stats.boards}`)
    console.log(`   Active boards: ${result.stats.activeBoards}`)
    console.log(`   Total items: ${result.stats.totalItems}`)
    console.log(`   Sync type: ${result.syncType}`)
    console.log(`   Timestamp: ${new Date(result.timestamp).toLocaleString()}`)

    console.log('\n🎯 Sync completed successfully!')
    console.log('Next steps:')
    console.log('1. Visit http://localhost:3005 to view dashboard')
    console.log('2. Click "Show Connections" to see board relationships')
    console.log('3. Run health analysis: npm run health-check')

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message)
    
    if (error.message.includes('API key')) {
      console.log('💡 Set your Monday.com API key:')
      console.log('   Add MONDAY_API_KEY to your .env file')
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Make sure the dev server is running:')
      console.log('   npm run dev')
    }
    
    console.error('\nFull error:', error.message)
    process.exit(1)
  }
}

async function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3005,
      path: '/api/sync',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve(res.statusCode !== undefined)
    })
    
    req.on('error', () => resolve(false))
    req.on('timeout', () => resolve(false))
    req.end()
  })
}

async function apiCall(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3005,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (res.statusCode >= 400) {
            reject(new Error(result.error || `HTTP ${res.statusCode}`))
          } else {
            resolve(result)
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (body) {
      req.write(JSON.stringify(body))
    }
    
    req.end()
  })
}

function showUsage() {
  console.log('Monday.com Data Sync Script')
  console.log('===========================')
  console.log('')
  console.log('PREREQUISITE: Make sure the dev server is running first!')
  console.log('  npm run dev')
  console.log('')
  console.log('Usage:')
  console.log('  node scripts/sync-monday-data.js [sync-type] [options]')
  console.log('')
  console.log('Sync Types:')
  console.log('  smart         Smart sync (default) - full or incremental based on cache age')
  console.log('  full          Full organization sync')
  console.log('  incremental   Incremental sync (active boards only)')
  console.log('  workspace     Sync specific workspace')
  console.log('')
  console.log('Options:')
  console.log('  --workspace=ID    Specify workspace ID (required for workspace sync)')
  console.log('  --force           Force full refresh regardless of cache age')
  console.log('  --dry-run         Show what would be synced without making changes')
  console.log('  --help, -h        Show this help message')
  console.log('')
  console.log('Examples:')
  console.log('  node scripts/sync-monday-data.js')
  console.log('  node scripts/sync-monday-data.js full --force')
  console.log('  node scripts/sync-monday-data.js workspace --workspace=12345678')
  console.log('  node scripts/sync-monday-data.js smart --dry-run')
  console.log('')
  console.log('Environment Variables:')
  console.log('  MONDAY_API_KEY    Your Monday.com API key (required)')
  console.log('  DATABASE_URL      PostgreSQL connection string (required)')
}

// Auto-run if called directly
if (require.main === module) {
  syncMondayData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error.message)
      process.exit(1)
    })
}

module.exports = { syncMondayData }
