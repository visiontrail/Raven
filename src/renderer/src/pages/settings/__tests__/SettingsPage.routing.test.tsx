import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import SettingsPage from '../SettingsPage'

vi.mock('@renderer/components/app/Navbar', () => ({
  Navbar: ({ children }: any) => <div>{children}</div>,
  NavbarCenter: ({ children }: any) => <div>{children}</div>
}))
vi.mock('@renderer/components/Scrollbar', () => ({ default: ({ children }: any) => <div>{children}</div> }))
vi.mock('../GeneralSettings', () => ({ default: () => <div>general-settings-content</div> }))
vi.mock('../AboutSettings', () => ({ default: () => null }))
vi.mock('../DisplaySettings/DisplaySettings', () => ({ default: () => null }))
vi.mock('../MCPSettings', () => ({ default: () => null }))
vi.mock('../MemorySettings', () => ({ default: () => null }))
vi.mock('../PreprocessSettings', () => ({ default: () => null }))
vi.mock('../QuickAssistantSettings', () => ({ default: () => null }))
vi.mock('../QuickPhraseSettings', () => ({ default: () => null }))
vi.mock('../ShortcutSettings', () => ({ default: () => null }))
vi.mock('../WebSearchSettings', () => ({ default: () => null }))

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

describe('SettingsPage service-managed model routing', () => {
  it('removes Provider/Model navigation and redirects a legacy URL', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/settings/provider']}>
        <LocationProbe />
        <Routes>
          <Route path="/settings/*" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/settings/general'))
    expect(screen.getByText('general-settings-content')).toBeInTheDocument()
    expect(container.querySelector('a[href="/settings/provider"]')).toBeNull()
    expect(container.querySelector('a[href="/settings/model"]')).toBeNull()
  })
})
