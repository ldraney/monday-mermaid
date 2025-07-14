import { NextResponse } from 'next/server'
import { sql } from '@/lib/database'

export async function GET() {
  try {
    const workspaces = await sql`SELECT id, name FROM workspaces LIMIT 10`
    const boards = await sql`SELECT id, name, workspace_id FROM boards LIMIT 10`
    
    return NextResponse.json({ workspaces, boards })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
