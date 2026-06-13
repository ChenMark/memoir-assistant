import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { sendMessage, generateStory, ChatMessage } from '../aiService'

// Mock fetch - using any to bypass strict type mismatch in test
(global as any).fetch = jest.fn()

describe('aiService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sendMessage', () => {
    test('should call API with correct parameters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn<() => Promise<any>>().mockResolvedValue({ success: true, data: 'Test reply' }),
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ]

      const result = await sendMessage(messages, 'childhood')

      expect(global.fetch).toHaveBeenCalledWith(
        '/ai/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ messages, dimensionId: 'childhood' }),
        })
      )
      expect(result).toBe('Test reply')
    })

    test('should handle API error', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn<() => Promise<any>>().mockResolvedValue({ success: false, error: 'API Error' }),
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ]

      await expect(sendMessage(messages, 'childhood')).rejects.toThrow('API Error')
    })

    test('should include auth token if available', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn<() => Promise<any>>().mockResolvedValue({ success: true, data: 'Test reply' }),
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      // Mock localStorage with token
      const localStorageMock = {
        getItem: jest.fn().mockReturnValue('test-token'),
      }
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
      })

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ]

      await sendMessage(messages, 'childhood')

      expect(global.fetch).toHaveBeenCalledWith(
        '/ai/chat',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      )
    })
  })

  describe('generateStory', () => {
    test('should call API with messages', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn<() => Promise<any>>().mockResolvedValue({ success: true, data: { story: 'Test story' } }),
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const messages: ChatMessage[] = [
        { role: 'user', content: 'My story' },
      ]

      const result = await generateStory(messages)

      expect(global.fetch).toHaveBeenCalledWith(
        '/ai/generate-story',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ messages }),
        })
      )
      expect(result).toBe('Test story')
    })
  })
})
