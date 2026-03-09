import React from 'react'
import { render, screen } from '@testing-library/react'
import AuditPage from '@/app/admin/audit/page'

describe('AuditPage', () => {
  beforeEach(() => {
    // reset fetch mock
    // @ts-expect-error lint: test expects error
    global.fetch = jest.fn()
  })

  afterEach(() => {
    // @ts-expect-error lint: test expects error
    global.fetch.mockReset()
  })

  test('renders audit page UI', () => {
    render(<AuditPage />)
    expect(screen.getByText('Audit Log')).toBeInTheDocument()
    expect(screen.getByText('Load')).toBeInTheDocument()
    expect(screen.getByText('Verify Chain')).toBeInTheDocument()
    expect(screen.getByText('Clear >365d')).toBeInTheDocument()
    const promoteNodes = screen.getAllByText('Evaluate & Promote')
    expect(promoteNodes.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Evaluate')).toBeInTheDocument()
  })
})
