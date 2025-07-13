#!/usr/bin/env node
// scripts/setup-database.js
// Initialize PostgreSQL database schema for monday-mermaid

const fs = require('fs')
const path = require('path')
const postgres = require('postgres')

// Load environment variables
require('dotenv').config()

async function setupDatabase() {
  console.log('🗄️ Setting up Monday Mermaid database...')
  
  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable not set')
    console.log('💡 Set DATABASE_URL in your .env file or environment')
    console.log('   Example: DATABASE_URL=postgresql://localhost:5432/monday_mermaid')
    process.exit(1)
  }

  let sql
  
  try {
    // Connect to PostgreSQL
    sql = postgres(databaseUrl, {
      max: 1, // Single connection for setup
    })
    
    console.log('🔌 Connected to PostgreSQL database')
    
    // Test connection
    await sql`SELECT 1 as test`
    console.log('✅ Database connection verified')
    
    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql')
    
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found:', schemaPath)
      process.exit(1)
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8')
    console.log('📄 Schema file loaded')
    
    // Execute schema
    console.log('🔨 Creating database schema...')
    await sql.unsafe(schemaSQL)
    
    console.log('✅ Database schema created successfully!')
    
    // Verify tables were created
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    
    console.log('📋 Created tables:')
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`)
    })
    
    // Insert initial health metric
    await sql`
      INSERT INTO health_metrics (scope, scope_id, metric_name, metric_value, status, valid_until) 
      VALUES ('organization', NULL, 'database_setup', 1, 'healthy', CURRENT_TIMESTAMP + INTERVAL '1 year')
      ON CONFLICT DO NOTHING
    `
    
    console.log('🎯 Database setup completed successfully!')
    console.log('')
    console.log('Next steps:')
    console.log('1. Set your MONDAY_API_KEY in .env')
    console.log('2. Run: npm run dev')
    console.log('3. Visit http://localhost:3005')
    console.log('4. Click "Discover Organization" to sync data')
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message)
    console.error('')
    
    if (error.message.includes('does not exist')) {
      console.log('💡 Database might not exist. Create it first:')
      console.log('   createdb monday_mermaid')
    } else if (error.message.includes('connection')) {
      console.log('💡 PostgreSQL might not be running. Start it:')
      console.log('   macOS: brew services start postgresql')
      console.log('   Linux: sudo systemctl start postgresql')
      console.log('   Docker: docker run -p 5432:5432 -e POSTGRES_PASSWORD=password postgres')
    }
    
    process.exit(1)
  } finally {
    if (sql) {
      await sql.end()
      console.log('🔌 Database connection closed')
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase()
}

module.exports = { setupDatabase }
