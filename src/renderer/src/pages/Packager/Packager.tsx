import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { Package } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import styled from 'styled-components'

const PackageTab = React.lazy(() => import('./PackageTab'))

const Packager: React.FC = () => {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  const menuItems = [
    { key: 'lingxi-10', label: t('packager.types.lingxi-10') },
    { key: 'lingxi-07a', label: t('packager.types.lingxi-07a') },
    { key: 'config', label: t('packager.types.config') },
    { key: 'lingxi-06-thrid', label: t('packager.types.lingxi-06-thrid') }
  ]

  const isRoute = (path: string): string => (pathname.includes(path) ? 'active' : '')

  return (
    <Container>
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none' }}>{t('packager.title')}</NavbarCenter>
      </Navbar>
      <ContentContainer>
        <SettingMenus>
          {menuItems.map((item) => (
            <MenuItemLink key={item.key} to={`/packager/${item.key}`}>
              <MenuItem className={isRoute(`/packager/${item.key}`)}>
                <Package size={18} />
                {item.label}
              </MenuItem>
            </MenuItemLink>
          ))}
        </SettingMenus>
        <SettingContent>
          <Routes>
            <Route path=":packageType" element={<PackageTab />} />
            <Route index element={<Navigate to="lingxi-10" replace />} />
          </Routes>
        </SettingContent>
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  height: calc(100% - var(--navbar-height));
`

const SettingMenus = styled.ul`
  display: flex;
  flex-direction: column;
  min-width: var(--settings-width);
  border-right: 0.5px solid var(--color-border);
  border-left: 0.5px solid var(--color-border);
  padding: 10px;
  user-select: none;
  background: #fff;
`

const MenuItemLink = styled(Link)`
  text-decoration: none;
  color: var(--color-text-1);
  margin-bottom: 5px;
`

const MenuItem = styled.li`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  width: 100%;
  cursor: pointer;
  border-radius: var(--list-item-border-radius);
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  border: 0.5px solid transparent;
  &:hover {
    background: var(--color-background-soft);
  }
  &.active {
    background: var(--color-background-soft);
    border: 0.5px solid var(--color-border);
  }
`

const SettingContent = styled.div`
  display: flex;
  height: 100%;
  flex: 1;
  padding: 24px;
  overflow: auto;
`

export default Packager
