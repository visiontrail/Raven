import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RavenAccountGate from '../RavenAccountGate'

const account = vi.hoisted(() => ({
  config: { baseUrl: 'http://service.example.test:8085' },
  profile: null as any,
  booting: false,
  authenticating: false,
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  retry: vi.fn()
}))

vi.mock('@renderer/context/RavenAccountContext', () => ({
  useRavenAccount: () => account
}))

describe('RavenAccountGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    account.profile = null
    account.login.mockResolvedValue(undefined)
    account.register.mockResolvedValue(undefined)
  })

  it('removes the startup overlay and keeps the login form operable', async () => {
    const startupOverlay = document.createElement('div')
    startupOverlay.id = 'spinner'
    document.body.appendChild(startupOverlay)

    render(
      <RavenAccountGate>
        <div>application shell</div>
      </RavenAccountGate>
    )

    expect(document.getElementById('spinner')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Raven' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('ravenAccount.username'), { target: { value: 'raven-user' } })
    fireEvent.change(screen.getByPlaceholderText('ravenAccount.password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'ravenAccount.login' }))

    await waitFor(() => expect(account.login).toHaveBeenCalledWith('raven-user', 'secret'))
  })

  it('collects the shared RavenAIService registration fields', async () => {
    render(
      <RavenAccountGate>
        <div>application shell</div>
      </RavenAccountGate>
    )

    fireEvent.click(screen.getByText('ravenAccount.register_tab'))
    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0], { target: { value: 'new-user' } })
    fireEvent.change(textboxes[1], { target: { value: 'New User' } })
    fireEvent.change(textboxes[2], { target: { value: 'new-user@example.test' } })
    const passwordInputs = document.querySelectorAll('input[type="password"]')
    fireEvent.change(passwordInputs[0], { target: { value: 'strong-password' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'strong-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'ravenAccount.register' }))

    await waitFor(() =>
      expect(account.register).toHaveBeenCalledWith({
        username: 'new-user',
        password: 'strong-password',
        display_name: 'New User',
        email: 'new-user@example.test'
      })
    )
  })

  it('does not render any app page before the global account is ready', () => {
    render(
      <RavenAccountGate>
        <div>application shell</div>
      </RavenAccountGate>
    )
    expect(screen.queryByText('application shell')).not.toBeInTheDocument()
  })

  it('erases registration credentials before returning to the gate after logout', async () => {
    const { rerender } = render(
      <RavenAccountGate>
        <div>application shell</div>
      </RavenAccountGate>
    )
    fireEvent.click(screen.getByText('ravenAccount.register_tab'))
    const passwordInputs = document.querySelectorAll('input[type="password"]')
    fireEvent.change(passwordInputs[0], { target: { value: 'strong-password' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'strong-password' } })

    account.profile = { id: 'user-1', username: 'new-user' }
    rerender(
      <RavenAccountGate>
        <div>application shell</div>
      </RavenAccountGate>
    )
    await waitFor(() => expect(screen.getByText('application shell')).toBeInTheDocument())
    account.profile = null
    rerender(
      <RavenAccountGate>
        <div>application shell</div>
      </RavenAccountGate>
    )

    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(1)
    expect(document.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe('')
  })
})
