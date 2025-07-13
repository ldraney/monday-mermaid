#!/usr/bin/env node
// scripts/health-check.js
// Analyze organizational health and generate recommendations

const { getOrganizationalStructure } = require('../lib/database')
const { healthAnalyzer } = require('../lib/health-analyzer')

// Load environment variables
require('dotenv').config()

async function runHealthCheck() {
  console.log('🏥 Monday.com Organization Health Check')
  console.log('=======================================')
  
  const args = process.argv.slice(2)
  const verbose = args.includes('--verbose') || args.includes('-v')
  const exportReport = args.includes('--export')
  const workspaceId = args.find(arg => arg.startsWith('--workspace='))?.split('=')[1]

  try {
    console.log('📊 Loading organizational data...')
    const orgData = await getOrganizationalStructure()
    
    if (!orgData || orgData.boards.length === 0) {
      console.error('❌ No organizational data found')
      console.log('💡 Run data sync first: npm run sync')
      process.exit(1)
    }

    console.log(`✅ Loaded data: ${orgData.workspaces.length} workspaces, ${orgData.boards.length} boards`)
    console.log(`📅 Data age: ${((Date.now() - orgData.lastScanned.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours`)
    console.log('')

    // Overall Health Analysis
    console.log('🎯 OVERALL HEALTH ANALYSIS')
    console.log('===========================')
    
    const healthMetrics = healthAnalyzer.analyzeOrganizationHealth(orgData)
    const overallScore = healthAnalyzer.calculateOverallHealthScore(orgData)
    const visualData = healthAnalyzer.getHealthMetricsForVisualization(orgData)
    
    console.log(`Overall Health Score: ${overallScore}/100 ${getScoreEmoji(overallScore)}`)
    console.log(`Active Boards: ${healthMetrics.activeBoards}/${healthMetrics.totalBoards} (${((healthMetrics.activeBoards/healthMetrics.totalBoards)*100).toFixed(1)}%)`)
    console.log(`Total Items: ${healthMetrics.totalItems.toLocaleString()}`)
    console.log(`Inactive Boards: ${healthMetrics.inactiveBoards.length}`)
    console.log(`Underutilized Boards: ${healthMetrics.underutilizedBoards.length}`)
    console.log('')

    // Board Health Breakdown
    console.log('📋 BOARD HEALTH BREAKDOWN')
    console.log('==========================')
    
    const boardHealthDetails = orgData.boards.map(board => healthAnalyzer.analyzeBoardHealth(board))
    const statusCounts = visualData.boardStatusCounts
    
    console.log(`✅ Healthy: ${statusCounts.healthy}`)
    console.log(`⚠️  Warning: ${statusCounts.warning}`)
    console.log(`😴 Inactive: ${statusCounts.inactive}`)
    console.log(`💀 Abandoned: ${statusCounts.abandoned}`)
    console.log('')

    // Activity Trends
    console.log('📈 ACTIVITY TRENDS')
    console.log('==================')
    console.log(`Daily Activity: ${healthMetrics.activitySummary.daily} boards updated`)
    console.log(`Weekly Activity: ${healthMetrics.activitySummary.weekly} boards updated`)
    console.log(`Monthly Activity: ${healthMetrics.activitySummary.monthly} boards updated`)
    console.log('')

    // Workspace Analysis
    if (orgData.workspaces.length > 1) {
      console.log('🏢 WORKSPACE HEALTH')
      console.log('===================')
      
      const workspaceHealthDetails = orgData.workspaces.map(workspace => 
        healthAnalyzer.analyzeWorkspaceHealth(workspace, orgData.boards)
      ).sort((a, b) => b.overallScore - a.overallScore)

      workspaceHealthDetails.forEach(ws => {
        const scoreEmoji = getScoreEmoji(ws.overallScore)
        console.log(`${scoreEmoji} ${ws.workspace.name}: ${ws.overallScore}/100`)
        console.log(`   Boards: ${ws.totalBoards} (${ws.boardsHealthy} healthy, ${ws.boardsWarning} warning, ${ws.boardsInactive} inactive)`)
      })
      console.log('')
    }

    // Problem Areas
    if (healthMetrics.inactiveBoards.length > 0 || healthMetrics.underutilizedBoards.length > 0) {
      console.log('⚠️  PROBLEM AREAS')
      console.log('=================')
      
      if (healthMetrics.inactiveBoards.length > 0) {
        console.log(`💤 ${healthMetrics.inactiveBoards.length} Inactive Boards:`)
        healthMetrics.inactiveBoards.slice(0, 10).forEach(board => {
          const lastActivity = board.updated_at ? new Date(board.updated_at).toLocaleDateString() : 'Unknown'
          console.log(`   • ${board.name} (${board.workspace?.name || 'Unknown workspace'}) - Last activity: ${lastActivity}`)
        })
        if (healthMetrics.inactiveBoards.length > 10) {
          console.log(`   ... and ${healthMetrics.inactiveBoards.length - 10} more`)
        }
        console.log('')
      }

      if (healthMetrics.underutilizedBoards.length > 0) {
        console.log(`📉 ${healthMetrics.underutilizedBoards.length} Underutilized Boards:`)
        healthMetrics.underutilizedBoards.slice(0, 10).forEach(board => {
          console.log(`   • ${board.name} (${board.items_count || 0} items) - ${board.workspace?.name || 'Unknown workspace'}`)
        })
        if (healthMetrics.underutilizedBoards.length > 10) {
          console.log(`   ... and ${healthMetrics.underutilizedBoards.length - 10} more`)
        }
        console.log('')
      }
    }

    // Recommendations
    console.log('💡 RECOMMENDATIONS')
    console.log('==================')
    const recommendations = healthAnalyzer.generateHealthRecommendations(orgData)
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`)
    })
    console.log('')

    // Detailed Analysis (if verbose)
    if (verbose) {
      console.log('🔍 DETAILED BOARD ANALYSIS')
      console.log('===========================')
      
      const problematicBoards = boardHealthDetails
        .filter(health => health.status !== 'healthy')
        .sort((a, b) => {
          const statusPriority = { abandoned: 4, inactive: 3, warning: 2, healthy: 1 }
          return statusPriority[b.status] - statusPriority[a.status]
        })
        .slice(0, 20)

      problematicBoards.forEach(health => {
        const statusEmoji = getStatusEmoji(health.status)
        console.log(`${statusEmoji} ${health.board.name}`)
        console.log(`   Workspace: ${health.board.workspace?.name || 'Unknown'}`)
        console.log(`   Status: ${health.status}`)
        console.log(`   Items: ${health.itemsCount}`)
        if (health.lastActivity) {
          console.log(`   Last Activity: ${health.lastActivity.toLocaleDateString()}`)
        }
        if (health.issues.length > 0) {
          console.log(`   Issues: ${health.issues.join(', ')}`)
        }
        if (health.recommendations.length > 0) {
          console.log(`   Recommendations: ${health.recommendations.join(', ')}`)
        }
        console.log('')
      })
    }

    // Export report if requested
    if (exportReport) {
      const report = {
        timestamp: new Date().toISOString(),
        overallScore,
        healthMetrics,
        boardHealthDetails,
        workspaceHealthDetails: orgData.workspaces.map(workspace => 
          healthAnalyzer.analyzeWorkspaceHealth(workspace, orgData.boards)
        ),
        recommendations,
        visualizationData: visualData
      }

      const fs = require('fs')
      const filename = `health-report-${new Date().toISOString().split('T')[0]}.json`
      fs.writeFileSync(filename, JSON.stringify(report, null, 2))
      console.log(`📄 Health report exported to: ${filename}`)
    }

    // Summary
    console.log('📋 SUMMARY')
    console.log('==========')
    console.log(`Overall Health: ${overallScore}/100 ${getScoreEmoji(overallScore)}`)
    console.log(`Key Issues: ${recommendations.length} recommendations`)
    console.log(`Action Required: ${healthMetrics.inactiveBoards.length + healthMetrics.underutilizedBoards.length} boards need attention`)
    console.log('')
    console.log('Next steps:')
    console.log('1. Review inactive boards for archival')
    console.log('2. Consolidate underutilized boards')
    console.log('3. Engage teams on low-activity boards')
    console.log('4. Run regular health checks (weekly recommended)')

  } catch (error) {
    console.error('❌ Health check failed:', error.message)
    
    if (error.message.includes('database')) {
      console.log('💡 Database connection issue. Try:')
      console.log('   node scripts/setup-database.js')
    } else if (error.message.includes('organizational data')) {
      console.log('💡 No data found. Sync first:')
      console.log('   node scripts/sync-monday-data.js')
    }
    
    process.exit(1)
  }
}

function getScoreEmoji(score) {
  if (score >= 90) return '🏆'
  if (score >= 80) return '✅'
  if (score >= 70) return '👍'
  if (score >= 60) return '⚠️'
  if (score >= 40) return '😟'
  return '🚨'
}

function getStatusEmoji(status) {
  switch (status) {
    case 'healthy': return '✅'
    case 'warning': return '⚠️'
    case 'inactive': return '😴'
    case 'abandoned': return '💀'
    default: return '❓'
  }
}

function showUsage() {
  console.log('Monday.com Health Check Script')
  console.log('==============================')
  console.log('')
  console.log('Usage:')
  console.log('  node scripts/health-check.js [options]')
  console.log('')
  console.log('Options:')
  console.log('  --verbose, -v     Show detailed board analysis')
  console.log('  --export          Export health report to JSON file')
  console.log('  --workspace=ID    Focus analysis on specific workspace')
  console.log('  --help, -h        Show this help message')
  console.log('')
  console.log('Examples:')
  console.log('  node scripts/health-check.js')
  console.log('  node scripts/health-check.js --verbose --export')
  console.log('  node scripts/health-check.js --workspace=12345678')
}

// Show usage if help requested
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  showUsage()
  process.exit(0)
}

// Auto-run if called directly
if (require.main === module) {
  runHealthCheck()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Health check failed:', error)
      process.exit(1)
    })
}

module.exports = { runHealthCheck }
