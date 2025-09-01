import { SearchOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons'
import { Button, Input, Select, Space } from 'antd'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { PackageType } from '../../types/package'

export interface PackageFilters {
  search: string
  packageType: PackageType | 'all'
  isPatch: 'all' | 'patch' | 'full'
}

export interface PackageSorting {
  field: 'created_at' | 'size' | 'name' | 'package_type'
  order: 'asc' | 'desc'
}

interface PackageFilterBarProps {
  filters: PackageFilters
  sorting: PackageSorting
  onFiltersChange: (filters: PackageFilters) => void
  onSortingChange: (sorting: PackageSorting) => void
  totalCount: number
}

const PackageFilterBar: FC<PackageFilterBarProps> = ({
  filters,
  sorting,
  onFiltersChange,
  onSortingChange,
  totalCount
}) => {
  const { t } = useTranslation()

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value })
  }

  const handlePackageTypeChange = (value: PackageType | 'all') => {
    onFiltersChange({ ...filters, packageType: value })
  }

  const handlePatchFilterChange = (value: 'all' | 'patch' | 'full') => {
    onFiltersChange({ ...filters, isPatch: value })
  }

  const handleSortFieldChange = (field: 'created_at' | 'size' | 'name' | 'package_type') => {
    if (sorting.field === field) {
      // Toggle order if same field
      onSortingChange({ field, order: sorting.order === 'asc' ? 'desc' : 'asc' })
    } else {
      // Set new field with default desc order
      onSortingChange({ field, order: 'desc' })
    }
  }

  const sortButtons = [
    { key: 'created_at', label: t('files.created_at') },
    { key: 'name', label: t('files.name') },
    { key: 'size', label: t('files.size') },
    { key: 'package_type', label: t('files.package_type') }
  ] as const

  const packageTypeOptions = [
    { value: 'all', label: t('files.all_types') },
    { value: PackageType.LINGXI_10, label: PackageType.LINGXI_10 },
    { value: PackageType.LINGXI_07A, label: PackageType.LINGXI_07A },
    { value: PackageType.CONFIG, label: PackageType.CONFIG },
    { value: PackageType.LINGXI_06TRD, label: PackageType.LINGXI_06TRD }
  ]

  const patchOptions = [
    { value: 'all', label: t('files.all_patches') },
    { value: 'patch', label: t('files.patch') },
    { value: 'full', label: t('files.full') }
  ]

  return (
    <Container>
      <TopRow>
        <SearchContainer>
          <Input
            placeholder={t('files.search_packages')}
            prefix={<SearchOutlined />}
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            allowClear
            style={{ width: 300 }}
          />
        </SearchContainer>
        <CountContainer>{t('files.packages_count', { count: totalCount })}</CountContainer>
      </TopRow>

      <BottomRow>
        <FiltersContainer>
          <Space>
            <Select
              value={filters.packageType}
              onChange={handlePackageTypeChange}
              options={packageTypeOptions}
              style={{ width: 140 }}
              size="small"
            />
            <Select
              value={filters.isPatch}
              onChange={handlePatchFilterChange}
              options={patchOptions}
              style={{ width: 120 }}
              size="small"
            />
          </Space>
        </FiltersContainer>

        <SortContainer>
          <SortLabel>{t('files.sort_by')}:</SortLabel>
          <Space size={4}>
            {sortButtons.map((button) => (
              <SortButton
                key={button.key}
                active={sorting.field === button.key}
                onClick={() => handleSortFieldChange(button.key)}
                size="small">
                {button.label}
                {sorting.field === button.key &&
                  (sorting.order === 'desc' ? <SortDescendingOutlined /> : <SortAscendingOutlined />)}
              </SortButton>
            ))}
          </Space>
        </SortContainer>
      </BottomRow>
    </Container>
  )
}

const Container = styled.div`
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--color-border);
  background-color: var(--color-background);
`

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`

const BottomRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const SearchContainer = styled.div`
  display: flex;
  align-items: center;
`

const CountContainer = styled.div`
  color: var(--color-text-secondary);
  font-size: 14px;
`

const FiltersContainer = styled.div`
  display: flex;
  align-items: center;
`

const SortContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const SortLabel = styled.span`
  color: var(--color-text-secondary);
  font-size: 14px;
`

const SortButton = styled(Button)<{ active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  height: 28px;
  border-radius: var(--list-item-border-radius);
  border: 0.5px solid ${(props) => (props.active ? 'var(--color-border)' : 'transparent')};
  background-color: ${(props) => (props.active ? 'var(--color-background-soft)' : 'transparent')};
  color: ${(props) => (props.active ? 'var(--color-text)' : 'var(--color-text-secondary)')};

  &:hover {
    background-color: var(--color-background-soft);
    color: var(--color-text);
  }

  .anticon {
    font-size: 12px;
  }
`

export default PackageFilterBar
