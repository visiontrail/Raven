import { ArrowRightOutlined } from '@ant-design/icons'
import { FC } from 'react'
import styled from 'styled-components'

interface ActionsListDividerProps {
  direction?: 'horizontal' | 'vertical'
  enabledCount?: number
  maxEnabled?: number
}

const ActionsListDivider: FC<ActionsListDividerProps> = ({ direction = 'horizontal' }) => {
  if (direction === 'vertical') {
    return (
      <VerticalContainer>
        <VerticalLine />
        <IconContainer>
          <ArrowRightOutlined />
        </IconContainer>
        <VerticalLine />
      </VerticalContainer>
    )
  }

  return (
    <HorizontalContainer>
      <HorizontalLine />
      <IconContainer>
        <ArrowRightOutlined />
      </IconContainer>
      <HorizontalLine />
    </HorizontalContainer>
  )
}

const HorizontalContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
`

const VerticalContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin: 0 16px;
`

const HorizontalLine = styled.div`
  flex: 1;
  height: 1px;
  background-color: var(--color-border);
`

const VerticalLine = styled.div`
  width: 1px;
  flex: 1;
  background-color: var(--color-border);
`

const IconContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--color-fill-2);
  color: var(--color-text-3);
  font-size: 12px;
`

export default ActionsListDivider
