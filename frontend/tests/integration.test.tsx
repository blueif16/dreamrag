import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock CopilotKit modules
jest.mock('@copilotkit/react-core', () => ({
  CopilotKit: ({ children }: { children: React.ReactNode }) => <div data-testid="copilotkit-provider">{children}</div>,
  useCopilotAction: jest.fn(),
  useCoAgent: jest.fn(() => ({
    state: {
      messages: [],
      current_task: '',
      result: '',
    },
    setState: jest.fn(),
  })),
}))

jest.mock('@copilotkit/react-ui', () => ({
  CopilotChat: () => <div data-testid="copilot-chat">Chat Component</div>,
}))

// Import after mocks
import { CopilotKit, useCopilotAction, useCoAgent } from '@copilotkit/react-core'
import { CopilotChat } from '@copilotkit/react-ui'

describe('CopilotKit Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('CopilotKit Provider', () => {
    it('renders children within CopilotKit provider', () => {
      render(
        <CopilotKit runtimeUrl="/api/copilotkit">
          <div data-testid="test-child">Test Content</div>
        </CopilotKit>
      )

      expect(screen.getByTestId('copilotkit-provider')).toBeInTheDocument()
      expect(screen.getByTestId('test-child')).toBeInTheDocument()
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })
  })

  describe('useCoAgent Hook', () => {
    it('initializes with default state', () => {
      const mockUseCoAgent = useCoAgent as jest.Mock
      mockUseCoAgent.mockReturnValue({
        state: {
          messages: [],
          current_task: '',
          result: '',
        },
        setState: jest.fn(),
      })

      const TestComponent = () => {
        const { state } = useCoAgent({
          name: 'test_agent',
          initialState: {
            messages: [],
            current_task: '',
            result: '',
          },
        })

        return (
          <div>
            <span data-testid="task">{state.current_task || 'none'}</span>
            <span data-testid="result">{state.result || 'none'}</span>
          </div>
        )
      }

      render(
        <CopilotKit runtimeUrl="/api/copilotkit">
          <TestComponent />
        </CopilotKit>
      )

      expect(screen.getByTestId('task')).toHaveTextContent('none')
      expect(screen.getByTestId('result')).toHaveTextContent('none')
    })

    it('provides setState function', () => {
      const mockSetState = jest.fn()
      const mockUseCoAgent = useCoAgent as jest.Mock
      mockUseCoAgent.mockReturnValue({
        state: {
          messages: [],
          current_task: 'test task',
          result: '',
        },
        setState: mockSetState,
      })

      const TestComponent = () => {
        const { state, setState } = useCoAgent({
          name: 'test_agent',
          initialState: {
            messages: [],
            current_task: '',
            result: '',
          },
        })

        return (
          <div>
            <span data-testid="task">{state.current_task}</span>
            <button onClick={() => setState({ ...state, current_task: 'updated' })}>
              Update
            </button>
          </div>
        )
      }

      render(
        <CopilotKit runtimeUrl="/api/copilotkit">
          <TestComponent />
        </CopilotKit>
      )

      expect(screen.getByTestId('task')).toHaveTextContent('test task')
    })
  })

  describe('useCopilotAction Hook', () => {
    it('registers action without errors', () => {
      const mockHandler = jest.fn()
      const mockUseCopilotAction = useCopilotAction as jest.Mock

      const TestComponent = () => {
        useCopilotAction({
          name: 'testAction',
          description: 'Test action description',
          parameters: [
            {
              name: 'param1',
              type: 'string',
              description: 'Test parameter',
              required: true,
            },
          ],
          handler: mockHandler,
        })

        return <div data-testid="action-component">Test</div>
      }

      render(
        <CopilotKit runtimeUrl="/api/copilotkit">
          <TestComponent />
        </CopilotKit>
      )

      expect(screen.getByTestId('action-component')).toBeInTheDocument()
      expect(mockUseCopilotAction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'testAction',
          description: 'Test action description',
        })
      )
    })

    it('registers multiple actions', () => {
      const mockUseCopilotAction = useCopilotAction as jest.Mock

      const TestComponent = () => {
        useCopilotAction({
          name: 'action1',
          description: 'First action',
          parameters: [],
          handler: async () => 'result1',
        })

        useCopilotAction({
          name: 'action2',
          description: 'Second action',
          parameters: [],
          handler: async () => 'result2',
        })

        return <div data-testid="multi-action">Multiple Actions</div>
      }

      render(
        <CopilotKit runtimeUrl="/api/copilotkit">
          <TestComponent />
        </CopilotKit>
      )

      expect(screen.getByTestId('multi-action')).toBeInTheDocument()
      expect(mockUseCopilotAction).toHaveBeenCalledTimes(2)
    })
  })

  describe('Full Stack Integration', () => {
    it('renders complete app structure with state sync', () => {
      const mockUseCoAgent = useCoAgent as jest.Mock
      mockUseCoAgent.mockReturnValue({
        state: {
          messages: ['msg1'],
          current_task: 'processing',
          result: 'success',
        },
        setState: jest.fn(),
      })

      const TestApp = () => {
        const { state } = useCoAgent({
          name: 'scaffold_agent',
          initialState: {
            messages: [],
            current_task: '',
            result: '',
          },
        })

        useCopilotAction({
          name: 'updateTask',
          description: 'Update current task',
          parameters: [
            {
              name: 'task',
              type: 'string',
              description: 'New task',
              required: true,
            },
          ],
          handler: async ({ task }) => `Task updated to ${task}`,
        })

        return (
          <div>
            <h1>CopilotKit + LangGraph</h1>
            <p data-testid="current-task">Task: {state.current_task || 'none'}</p>
            <p data-testid="result">Result: {state.result || 'none'}</p>
            <CopilotChat />
          </div>
        )
      }

      render(
        <CopilotKit runtimeUrl="/api/copilotkit">
          <TestApp />
        </CopilotKit>
      )

      expect(screen.getByText('CopilotKit + LangGraph')).toBeInTheDocument()
      expect(screen.getByTestId('current-task')).toHaveTextContent('Task: processing')
      expect(screen.getByTestId('result')).toHaveTextContent('Result: success')
      expect(screen.getByTestId('copilot-chat')).toBeInTheDocument()
    })
  })
})
