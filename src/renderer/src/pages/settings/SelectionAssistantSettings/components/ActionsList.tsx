import { Draggable, Droppable } from '@hello-pangea/dnd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Card, Empty, Space, Typography } from 'antd'
import { DynamicIcon } from 'lucide-react/dynamic'
import { MessageSquareHeart } from 'lucide-react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { ActionItem } from '@renderer/types/selectionTypes'

const { Text } = Typography

interface ActionsListProps {
  title: string
  items: ActionItem[]
  droppableId: string
  onEdit: (item: ActionItem) => void
  onDelete: (id: string) => void
  onAdd?: () => void
  showAddButton?: boolean
  maxItems?: number
  isLastEnabledItem?: boolean
  getSearchEngineInfo?: (searchEngine: string) => { icon: any; name: string } | null
}

const ActionsList: FC<ActionsListProps> = ({
  title,
  items,
  droppableId,
  onEdit,
  onDelete,
  onAdd,
  showAddButton = false,
  maxItems,
  getSearchEngineInfo
}) => {
  const { t } = useTranslation()

  const renderActionIcon = (item: ActionItem) => {
    if (item.id === 'search' && item.searchEngine && getSearchEngineInfo) {
      const searchInfo = getSearchEngineInfo(item.searchEngine)
      if (searchInfo?.icon) {
        return searchInfo.icon
      }
    }
    
    return (
      <DynamicIcon
        name={item.icon as any}
        size={16}
        fallback={() => <MessageSquareHeart size={16} />}
      />
    )
  }

  const renderActionName = (item: ActionItem) => {
    if (item.id === 'search' && item.searchEngine && getSearchEngineInfo) {
      const searchInfo = getSearchEngineInfo(item.searchEngine)
      if (searchInfo) {
        return `${item.isBuiltIn ? t(item.name) : item.name} (${searchInfo.name})`
      }
    }
    return item.isBuiltIn ? t(item.name) : item.name
  }

  return (
    <Container>
      <Header>
        <Title>{title}</Title>
        {maxItems && (
          <Count>
            {items.length}/{maxItems}
          </Count>
        )}
      </Header>
      
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <ListContainer
            ref={provided.innerRef}
            {...provided.droppableProps}
            $isDraggingOver={snapshot.isDraggingOver}
          >
            {items.length === 0 ? (
              <EmptyContainer>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('selection.settings.actions.empty')}
                />
              </EmptyContainer>
            ) : (
              items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided, snapshot) => (
                    <ActionCard
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      $isDragging={snapshot.isDragging}
                    >
                      <ActionContent>
                        <ActionIcon>
                          {renderActionIcon(item)}
                        </ActionIcon>
                        <ActionInfo>
                          <ActionName>{renderActionName(item)}</ActionName>
                          {item.prompt && (
                            <ActionPrompt>{item.prompt}</ActionPrompt>
                          )}
                        </ActionInfo>
                      </ActionContent>
                      
                      <ActionButtons>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => onEdit(item)}
                        />
                        {!item.isBuiltIn && (
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => onDelete(item.id)}
                            danger
                          />
                        )}
                      </ActionButtons>
                    </ActionCard>
                  )}
                </Draggable>
              ))
            )}
            {provided.placeholder}
            
            {showAddButton && onAdd && (
              <AddButton onClick={onAdd}>
                <PlusOutlined />
                <span>{t('selection.settings.actions.add')}</span>
              </AddButton>
            )}
          </ListContainer>
        )}
      </Droppable>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const Title = styled.h4`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
`

const Count = styled.span`
  font-size: 12px;
  color: var(--color-text-3);
`

const ListContainer = styled.div<{ $isDraggingOver: boolean }>`
  min-height: 120px;
  padding: 8px;
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  background-color: ${props => props.$isDraggingOver ? 'var(--color-fill-2)' : 'transparent'};
  transition: all 0.2s ease;
`

const EmptyContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
`

const ActionCard = styled(Card)<{ $isDragging: boolean }>`
  margin-bottom: 8px;
  cursor: grab;
  transform: ${props => props.$isDragging ? 'rotate(5deg)' : 'none'};
  box-shadow: ${props => props.$isDragging ? '0 8px 16px rgba(0,0,0,0.15)' : 'none'};
  transition: all 0.2s ease;
  
  &:active {
    cursor: grabbing;
  }
  
  .ant-card-body {
    padding: 12px;
  }
`

const ActionContent = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
`

const ActionIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background-color: var(--color-fill-2);
  color: var(--color-text-2);
`

const ActionInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const ActionName = styled.div`
  font-weight: 500;
  color: var(--color-text-1);
  margin-bottom: 2px;
`

const ActionPrompt = styled(Text)`
  font-size: 12px;
  color: var(--color-text-3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const ActionButtons = styled(Space)`
  margin-left: auto;
`

const AddButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  background-color: var(--color-fill-1);
  color: var(--color-text-3);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background-color: var(--color-primary-bg);
  }
`

export default ActionsList