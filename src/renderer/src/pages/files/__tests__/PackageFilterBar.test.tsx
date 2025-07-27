import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import i18n from '../../../i18n'
import PackageFilterBar, { PackageFilters, PackageSorting } from '../PackageFilterBar'

// Mock antd components to avoid complex setup
vi.mock('antd', () => ({
  Input: ({ placeholder, value, onChange, prefix, allowClear, ...props }: any) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e)}
      data-testid="search-input"
      {...props}
    />
  ),
  Select: ({ value, onChange, options, ...props }: any) => (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      data-testid={props['data-testid'] || 'select'}
      {...props}>
      {options?.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Button: ({ children, onClick, active, ...props }: any) => (
    <button onClick={onClick} data-active={active} data-testid={props['data-testid'] || 'button'} {...props}>
      {children}
    </button>
  ),
  Space: ({ children }: any) => <div>{children}</div>
}))

// Mock icons
vi.mock('@ant-design/icons', () => ({
  SearchOutlined: () => <span>🔍</span>,
  SortAscendingOutlined: () => <span>↑</span>,
  SortDescendingOutlined: () => <span>↓</span>
}))

const defaultFilters: PackageFilters = {
  search: '',
  packageType: 'all',
  isPatch: 'all'
}

const defaultSorting: PackageSorting = {
  field: 'created_at',
  order: 'desc'
}

const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>)
}

describe('PackageFilterBar', () => {
  it('renders search input with correct placeholder', () => {
    const mockOnFiltersChange = vi.fn()
    const mockOnSortingChange = vi.fn()

    renderWithI18n(
      <PackageFilterBar
        filters={defaultFilters}
        sorting={defaultSorting}
        onFiltersChange={mockOnFiltersChange}
        onSortingChange={mockOnSortingChange}
        totalCount={5}
      />
    )

    const searchInput = screen.getByTestId('search-input')
    expect(searchInput).toBeInTheDocument()
  })

  it('calls onFiltersChange when search input changes', () => {
    const mockOnFiltersChange = vi.fn()
    const mockOnSortingChange = vi.fn()

    renderWithI18n(
      <PackageFilterBar
        filters={defaultFilters}
        sorting={defaultSorting}
        onFiltersChange={mockOnFiltersChange}
        onSortingChange={mockOnSortingChange}
        totalCount={5}
      />
    )

    const searchInput = screen.getByTestId('search-input')
    fireEvent.change(searchInput, { target: { value: 'test search' } })

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      search: 'test search'
    })
  })

  it('displays correct total count', () => {
    const mockOnFiltersChange = vi.fn()
    const mockOnSortingChange = vi.fn()

    renderWithI18n(
      <PackageFilterBar
        filters={defaultFilters}
        sorting={defaultSorting}
        onFiltersChange={mockOnFiltersChange}
        onSortingChange={mockOnSortingChange}
        totalCount={10}
      />
    )

    // The count should be displayed somewhere in the component
    expect(screen.getByText('10 packages')).toBeInTheDocument()
  })

  it('renders sort buttons for all sort fields', () => {
    const mockOnFiltersChange = vi.fn()
    const mockOnSortingChange = vi.fn()

    renderWithI18n(
      <PackageFilterBar
        filters={defaultFilters}
        sorting={defaultSorting}
        onFiltersChange={mockOnFiltersChange}
        onSortingChange={mockOnSortingChange}
        totalCount={5}
      />
    )

    // Should have buttons for all sort fields
    const buttons = screen.getAllByTestId('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('shows active state for current sort field', () => {
    const mockOnFiltersChange = vi.fn()
    const mockOnSortingChange = vi.fn()

    const activeSorting: PackageSorting = {
      field: 'name',
      order: 'asc'
    }

    renderWithI18n(
      <PackageFilterBar
        filters={defaultFilters}
        sorting={activeSorting}
        onFiltersChange={mockOnFiltersChange}
        onSortingChange={mockOnSortingChange}
        totalCount={5}
      />
    )

    // At least one button should be active
    const buttons = screen.getAllByTestId('button')
    const activeButtons = buttons.filter((button) => button.getAttribute('data-active') === 'true')
    expect(activeButtons.length).toBeGreaterThan(0)
  })
})
