import { isLockedModeEnabled } from '@renderer/config/locked-settings'
import { Input, InputRef, Tooltip } from 'antd'
import { Search } from 'lucide-react'
import { motion } from 'motion/react'
import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface CollapsibleSearchBarProps {
  onSearch: (text: string) => void
  icon?: React.ReactNode
  maxWidth?: string | number
}

/**
 * A collapsible search bar for list headers
 * Renders as an icon initially, expands to full search input when clicked
 */
const CollapsibleSearchBar: React.FC<CollapsibleSearchBarProps> = ({ onSearch, icon, maxWidth }) => {
  const { t } = useTranslation()
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const inputRef = useRef<InputRef>(null)

  const isLocked = isLockedModeEnabled()

  const handleTextChange = useCallback(
    (text: string) => {
      if (isLocked) return
      setSearchText(text)
      onSearch(text)
    },
    [onSearch, isLocked]
  )

  const handleClear = useCallback(() => {
    if (isLocked) return
    setSearchText('')
    setSearchVisible(false)
    onSearch('')
  }, [onSearch, isLocked])

  useEffect(() => {
    if (searchVisible && inputRef.current) {
      inputRef.current.focus()
    }
  }, [searchVisible])

  return (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
      <motion.div
        initial="collapsed"
        animate={searchVisible ? 'expanded' : 'collapsed'}
        variants={{
          expanded: { maxWidth: maxWidth || '100%', opacity: 1, transition: { duration: 0.3, ease: 'easeInOut' } },
          collapsed: { maxWidth: 0, opacity: 0, transition: { duration: 0.3, ease: 'easeInOut' } }
        }}
        style={{ overflow: 'hidden', flex: 1 }}>
        <Input
          ref={inputRef}
          type="text"
          placeholder={isLocked ? t('settings.provider.locked_search') : t('models.search')}
          size="small"
          suffix={icon || <Search size={14} color="var(--color-icon)" />}
          value={searchText}
          autoFocus
          allowClear={!isLocked}
          disabled={isLocked}
          onChange={(e) => !isLocked && handleTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isLocked) {
              handleTextChange('')
              if (!searchText) setSearchVisible(false)
            }
          }}
          onBlur={() => {
            if (!searchText && !isLocked) setSearchVisible(false)
          }}
          onClear={handleClear}
          style={{ width: '100%' }}
        />
      </motion.div>
      <motion.div
        initial="visible"
        animate={searchVisible ? 'hidden' : 'visible'}
        variants={{
          visible: { opacity: 1, transition: { duration: 0.1, delay: 0.3, ease: 'easeInOut' } },
          hidden: { opacity: 0, transition: { duration: 0.1, ease: 'easeInOut' } }
        }}
        style={{ cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex' }}
        onClick={() => !isLocked && setSearchVisible(true)}>
        <Tooltip title={isLocked ? t('settings.provider.locked_search') : t('models.search')} mouseEnterDelay={0.5}>
          <Search size={14} color={isLocked ? 'var(--color-text-disabled)' : 'var(--color-icon)'} />
        </Tooltip>
      </motion.div>
    </div>
  )
}

export default memo(CollapsibleSearchBar)
