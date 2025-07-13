-- sql/schema.sql
-- PostgreSQL schema for monday-mermaid organizational intelligence platform
-- Designed for efficient caching, analysis, and management operations

-- Enable UUID extension for generating IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- WORKSPACES TABLE
-- =============================================================================

CREATE TABLE workspaces (
    id VARCHAR(50) PRIMARY KEY,  -- Monday.com workspace ID
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(50) NOT NULL,
    description TEXT,
    product_kind VARCHAR(50),
    
    -- Metadata
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Search optimization
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', name || ' ' || COALESCE(description, ''))
    ) STORED
);

-- =============================================================================
-- BOARDS TABLE  
-- =============================================================================

CREATE TABLE boards (
    id VARCHAR(50) PRIMARY KEY,  -- Monday.com board ID
    workspace_id VARCHAR(50) REFERENCES workspaces(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    state VARCHAR(20) DEFAULT 'active' CHECK (state IN ('active', 'archived', 'deleted')),
    board_folder_id VARCHAR(50),
    board_kind VARCHAR(50),
    
    -- Metrics for health analysis
    items_count INTEGER DEFAULT 0,
    permissions VARCHAR(20),
    
    -- Timestamps for health analysis
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    last_activity TIMESTAMP,
    
    -- Metadata
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Calculated health metrics (updated by health analyzer)
    health_status VARCHAR(20) DEFAULT 'unknown' CHECK (
        health_status IN ('healthy', 'warning', 'inactive', 'abandoned', 'unknown')
    ),
    health_score INTEGER DEFAULT 0 CHECK (health_score >= 0 AND health_score <= 100),
    
    -- Search optimization
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', name || ' ' || COALESCE(description, ''))
    ) STORED
);

-- =============================================================================
-- COLUMNS TABLE
-- =============================================================================

CREATE TABLE columns (
    id VARCHAR(50) PRIMARY KEY,  -- Monday.com column ID
    board_id VARCHAR(50) REFERENCES boards(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    settings_str TEXT,  -- JSON settings from Monday.com
    archived BOOLEAN DEFAULT FALSE,
    position VARCHAR(20),  -- Monday.com position string
    
    -- Metadata
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- BOARD TAGS TABLE
-- =============================================================================

CREATE TABLE board_tags (
    id VARCHAR(50) PRIMARY KEY,  -- Monday.com tag ID
    board_id VARCHAR(50) REFERENCES boards(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    color VARCHAR(20),
    
    -- Metadata
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- BOARD RELATIONSHIPS TABLE
-- =============================================================================

CREATE TABLE board_relationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    source_board_id VARCHAR(50) REFERENCES boards(id) ON DELETE CASCADE,
    target_board_id VARCHAR(50) REFERENCES boards(id) ON DELETE CASCADE,
    
    relationship_type VARCHAR(30) NOT NULL CHECK (
        relationship_type IN ('dependency', 'mirror', 'connect', 'integration', 'automation')
    ),
    
    -- Connection details
    source_column_id VARCHAR(50),  -- References columns(id)
    target_column_id VARCHAR(50),  -- References columns(id)
    
    -- Metadata about the relationship
    metadata JSONB DEFAULT '{}',  -- Store additional relationship info
    
    -- Tracking
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_verified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Ensure no duplicate relationships
    UNIQUE(source_board_id, target_board_id, relationship_type, source_column_id)
);

-- =============================================================================
-- USERS TABLE
-- =============================================================================

CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,  -- Monday.com user ID
    
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    is_guest BOOLEAN DEFAULT FALSE,
    
    last_activity TIMESTAMP,
    
    -- Metadata
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- HEALTH METRICS TABLE
-- =============================================================================

CREATE TABLE health_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Scope of the health metric
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('organization', 'workspace', 'board')),
    scope_id VARCHAR(50),  -- workspace_id or board_id (NULL for organization)
    
    -- Health metrics
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    metric_data JSONB DEFAULT '{}',  -- Store complex metric data
    
    -- Health status
    status VARCHAR(20) CHECK (status IN ('healthy', 'warning', 'critical')),
    
    -- Metadata
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP
);

-- =============================================================================
-- SYNC METADATA TABLE
-- =============================================================================

CREATE TABLE sync_metadata (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    sync_type VARCHAR(50) NOT NULL,  -- 'full_sync', 'incremental_sync', 'health_analysis'
    
    -- Sync scope
    workspace_id VARCHAR(50),  -- NULL for organization-wide sync
    board_id VARCHAR(50),      -- NULL for workspace or organization sync
    
    -- Sync results
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    
    -- Statistics
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_deleted INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Error tracking
    error_message TEXT,
    error_details JSONB,
    
    -- Metadata
    sync_config JSONB DEFAULT '{}'  -- Store sync configuration
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Workspace indexes
CREATE INDEX idx_workspaces_search ON workspaces USING GIN(search_vector);

-- Board indexes  
CREATE INDEX idx_boards_workspace ON boards(workspace_id);
CREATE INDEX idx_boards_state ON boards(state);
CREATE INDEX idx_boards_health ON boards(health_status, health_score);
CREATE INDEX idx_boards_activity ON boards(last_activity DESC);
CREATE INDEX idx_boards_search ON boards USING GIN(search_vector);

-- Column indexes
CREATE INDEX idx_columns_board ON columns(board_id);
CREATE INDEX idx_columns_type ON columns(type);

-- Relationship indexes
CREATE INDEX idx_relationships_source ON board_relationships(source_board_id);
CREATE INDEX idx_relationships_target ON board_relationships(target_board_id);
CREATE INDEX idx_relationships_type ON board_relationships(relationship_type);
CREATE INDEX idx_relationships_active ON board_relationships(is_active);

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_activity ON users(last_activity DESC);

-- Tag indexes
CREATE INDEX idx_tags_board ON board_tags(board_id);

-- Health metrics indexes
CREATE INDEX idx_health_metrics_scope ON health_metrics(scope, scope_id, calculated_at);

-- Sync metadata indexes
CREATE INDEX idx_sync_metadata_status ON sync_metadata(status, started_at);
CREATE INDEX idx_sync_metadata_scope ON sync_metadata(workspace_id, board_id);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Organization overview
CREATE VIEW organization_overview AS
SELECT 
    COUNT(DISTINCT w.id) as total_workspaces,
    COUNT(DISTINCT b.id) as total_boards,
    COUNT(DISTINCT CASE WHEN b.state = 'active' THEN b.id END) as active_boards,
    COUNT(DISTINCT CASE WHEN b.state = 'archived' THEN b.id END) as archived_boards,
    SUM(b.items_count) as total_items,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT br.id) as total_relationships,
    MAX(b.last_synced) as last_sync_time
FROM workspaces w
LEFT JOIN boards b ON w.id = b.workspace_id
LEFT JOIN users u ON TRUE  -- Cross join for total user count
LEFT JOIN board_relationships br ON TRUE;

-- Board health summary
CREATE VIEW board_health_summary AS
SELECT 
    b.id,
    b.name,
    b.workspace_id,
    w.name as workspace_name,
    b.state,
    b.health_status,
    b.health_score,
    b.items_count,
    b.last_activity,
    b.last_synced,
    COUNT(br_out.id) as outgoing_relationships,
    COUNT(br_in.id) as incoming_relationships
FROM boards b
JOIN workspaces w ON b.workspace_id = w.id
LEFT JOIN board_relationships br_out ON b.id = br_out.source_board_id AND br_out.is_active = TRUE
LEFT JOIN board_relationships br_in ON b.id = br_in.target_board_id AND br_in.is_active = TRUE
GROUP BY b.id, b.name, b.workspace_id, w.name, b.state, b.health_status, b.health_score, b.items_count, b.last_activity, b.last_synced;

-- =============================================================================
-- FUNCTIONS FOR DATA MANAGEMENT
-- =============================================================================

-- Function to update last_synced timestamp
CREATE OR REPLACE FUNCTION update_last_synced()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_synced = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update last_synced
CREATE TRIGGER trigger_workspaces_last_synced
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_last_synced();

CREATE TRIGGER trigger_boards_last_synced
    BEFORE UPDATE ON boards
    FOR EACH ROW
    EXECUTE FUNCTION update_last_synced();

CREATE TRIGGER trigger_columns_last_synced
    BEFORE UPDATE ON columns
    FOR EACH ROW
    EXECUTE FUNCTION update_last_synced();

-- Function to calculate board health score (simplified version)
CREATE OR REPLACE FUNCTION calculate_board_health_score(board_id_param VARCHAR(50))
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    days_since_activity INTEGER;
    item_count INTEGER;
BEGIN
    SELECT 
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(last_activity, created_at)))::INTEGER,
        COALESCE(items_count, 0)
    INTO days_since_activity, item_count
    FROM boards 
    WHERE id = board_id_param;
    
    -- Base score
    score := 50;
    
    -- Activity bonus/penalty
    IF days_since_activity <= 7 THEN
        score := score + 30;
    ELSIF days_since_activity <= 30 THEN
        score := score + 10;
    ELSIF days_since_activity > 90 THEN
        score := score - 30;
    END IF;
    
    -- Items bonus
    IF item_count > 20 THEN
        score := score + 20;
    ELSIF item_count > 5 THEN
        score := score + 10;
    ELSIF item_count = 0 THEN
        score := score - 20;
    END IF;
    
    -- Ensure score is within bounds
    score := GREATEST(0, LEAST(100, score));
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INITIAL DATA SETUP
-- =============================================================================

-- Insert default health metric definitions
INSERT INTO health_metrics (scope, scope_id, metric_name, metric_value, status, valid_until) VALUES 
('organization', NULL, 'setup_complete', 1, 'healthy', CURRENT_TIMESTAMP + INTERVAL '1 year');

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'Monday Mermaid database schema created successfully!';
    RAISE NOTICE 'Ready for organizational data caching and analysis.';
END $$;
