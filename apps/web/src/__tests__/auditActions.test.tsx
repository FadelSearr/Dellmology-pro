import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuditPage from '@/app/admin/audit/page'

describe('AuditPage actions', () => {
  beforeEach(() => {
    // @ts-expect-error lint: test expects error
    global.fetch = jest.fn()
  })

  afterEach(() => {
    // @ts-expect-error lint: test expects error
    global.fetch.mockReset()
    jest.clearAllMocks()
  })

  it('shows toast after Evaluate (non-promote) success', async () => {
    // Mock evaluate-promote endpoint
    // First call: evaluatePromote -> returns ok json
    // When Evaluate button clicked, fetch called once
    // return a successful JSON
    // @ts-expect-error lint: test expects error
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'ok' }) })

    render(<AuditPage />)

    const evalBtn = screen.getByText('Evaluate')
    fireEvent.click(evalBtn)

    await waitFor(() => {
      expect(screen.getByText('Evaluation completed')).toBeInTheDocument()
    })
  })

  it('opens confirmation modal and confirms auto-promote', async () => {
    // First click triggers confirmation display, second triggers POST
    // @ts-expect-error lint: test expects error
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ promoted: true }) })

    render(<AuditPage />)

    const promoteBtn = screen.getByRole('button', { name: 'Evaluate & Promote' })
    fireEvent.click(promoteBtn)

    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Confirm Auto-Promote')).toBeInTheDocument()
    })

    const confirmBtn = screen.getByText('Confirm')
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByText(/Evaluate & Promote completed|Evaluation completed/)).toBeTruthy()
    })
  })
})
