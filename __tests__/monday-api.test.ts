// __tests__/monday-api.test.ts
// Tests for Monday.com API integration

import { MondayAPI } from '../lib/monday-api'
import { config } from '../lib/config'

// Mock environment for testing
process.env.MONDAY_API_KEY = 'test-api-key'
process.env.DATABASE_URL = 'postgresql://localhost:5432/test_db'

describe('MondayAPI', () => {
  let api: MondayAPI

  beforeEach(() => {
    api = new MondayAPI('test-api-key')
  })

  describe('initialization', () => {
    it('should initialize with API key', () => {
      expect(api).toBeInstanceOf(MondayAPI)
    })

    it('should use default API key from config if none provided', () => {
      const defaultApi = new MondayAPI()
      expect(defaultApi).toBeInstanceOf(MondayAPI)
    })
  })

  describe('query method', () => {
    beforeEach(() => {
      // Mock fetch globally
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should make POST request with correct headers', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ data: { test: 'success' } })
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const query = 'query { me { id name } }'
      await api['query'](query)

      expect(global.fetch).toHaveBeenCalledWith(
        config.monday.apiUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'test-api-key',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ query, variables: {} })
        })
      )
    })

    it('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const query = 'query { me { id name } }'
      
      await expect(api['query'](query)).rejects.toThrow('Monday.com API error: 401 Unauthorized')
    })

    it('should handle GraphQL errors', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: null,
          errors: [{ message: 'Invalid query' }]
        })
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const query = 'invalid query'
      
      await expect(api['query'](query)).rejects.toThrow('Monday.com GraphQL error: Invalid query')
    })
  })

  describe('testConnection', () => {
    beforeEach(() => {
      global.fetch = jest.fn()
      global.console.log = jest.fn()
      global.console.error = jest.fn()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should return true for successful connection', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: { me: { id: '123', name: 'Test User' } }
        })
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await api.testConnection()
      
      expect(result).toBe(true)
      expect(console.log).toHaveBeenCalledWith('✅ Monday.com API connected successfully as Test User')
    })

    it('should return false for failed connection', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const result = await api.testConnection()
      
      expect(result).toBe(false)
      expect(console.error).toHaveBeenCalledWith('❌ Monday.com API connection failed:', expect.any(Error))
    })
  })

  describe('getWorkspaces', () => {
    beforeEach(() => {
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should fetch and return workspaces', async () => {
      const mockWorkspaces = [
        { id: '1', name: 'Workspace 1', kind: 'open' },
        { id: '2', name: 'Workspace 2', kind: 'closed' }
      ]
      
      const mockResponse = {
        ok: true,
        json: async () => ({ data: { workspaces: mockWorkspaces } })
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await api.getWorkspaces()
      
      expect(result).toEqual(mockWorkspaces)
      expect(global.fetch).toHaveBeenCalledWith(
        config.monday.apiUrl,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('workspaces')
        })
      )
    })
  })

  describe('discoverOrganization', () => {
    beforeEach(() => {
      global.fetch = jest.fn()
      global.console.log = jest.fn()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should discover complete organization structure', async () => {
      // Mock workspaces response
      const mockWorkspaces = [{ id: '1', name: 'Test Workspace', kind: 'open' }]
      // Mock users response  
      const mockUsers = [{ id: 'u1', name: 'Test User', email: 'test@example.com', enabled: true, is_admin: false, is_guest: false }]
      // Mock boards response
      const mockBoards = [{ 
        id: 'b1', 
        name: 'Test Board', 
        state: 'active', 
        board_kind: 'public',
        workspace: { id: '1', name: 'Test Workspace' },
        columns: [],
        items_count: 5
      }]

      let callCount = 0
      ;(global.fetch as jest.Mock).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // Workspaces call
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { workspaces: mockWorkspaces } })
          })
        } else if (callCount === 2) {
          // Users call
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { users: mockUsers } })
          })
        } else {
          // Boards call
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { boards: mockBoards } })
          })
        }
      })

      const result = await api.discoverOrganization()
      
      expect(result).toEqual(expect.objectContaining({
        workspaces: mockWorkspaces,
        boards: mockBoards,
        users: mockUsers,
        relationships: [],
        healthMetrics: expect.objectContaining({
          totalWorkspaces: 1,
          totalBoards: 1,
          activeBoards: 1,
          totalItems: 5
        })
      }))
    })
  })
})

// Mock configuration for testing
jest.mock('../lib/config', () => ({
  config: {
    monday: {
      apiUrl: 'https://api.monday.com/v2',
      version: '2024-01'
    }
  }
}))

// Export for potential test utilities
export { }
