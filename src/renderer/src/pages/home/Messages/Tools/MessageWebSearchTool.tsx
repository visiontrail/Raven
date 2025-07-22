import { WebSearchToolInput, WebSearchToolOutput } from '@renderer/aiCore/tools/WebSearchTool'
import Spinner from '@renderer/components/Spinner'
import i18n from '@renderer/i18n'
import { MCPToolResponse } from '@renderer/types'
import { Typography } from 'antd'
import { Search } from 'lucide-react'
import styled from 'styled-components'

const { Text, Link } = Typography

export const MessageWebSearchToolTitle = ({ toolResponse }: { toolResponse: MCPToolResponse }) => {
  const toolInput = toolResponse.arguments as WebSearchToolInput
  const toolOutput = toolResponse.response as WebSearchToolOutput

  return toolResponse.status !== 'done' ? (
    <Spinner
      text={
        <PrepareToolWrapper>
          {i18n.t('message.searching')}
          <span>{toolInput?.query ?? ''}</span>
        </PrepareToolWrapper>
      }
    />
  ) : (
    <MessageWebSearchToolTitleTextWrapper type="secondary">
      <Search size={16} style={{ color: 'unset' }} />
      {i18n.t('message.websearch.fetch_complete', { count: toolOutput.results.length ?? 0 })}
    </MessageWebSearchToolTitleTextWrapper>
  )
}

export const MessageWebSearchToolBody = ({ toolResponse }: { toolResponse: MCPToolResponse }) => {
  const toolOutput = toolResponse.response as WebSearchToolOutput

  return toolResponse.status === 'done' ? (
    <MessageWebSearchToolBodyUlWrapper>
      {toolOutput.results.map((result) => (
        <li key={result.url}>
          <Link href={result.url}>{result.title}</Link>
        </li>
      ))}
    </MessageWebSearchToolBodyUlWrapper>
  ) : null
}

const PrepareToolWrapper = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  padding-left: 0;
`

const MessageWebSearchToolTitleTextWrapper = styled(Text)`
  display: flex;
  align-items: center;
  gap: 4px;
`

const MessageWebSearchToolBodyUlWrapper = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
`
