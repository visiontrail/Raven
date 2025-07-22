import type { ToolMessageBlock } from '@renderer/types/newMessage'
import { Collapse } from 'antd'

import { MessageWebSearchToolBody, MessageWebSearchToolTitle } from './MessageWebSearchTool'

interface Props {
  block: ToolMessageBlock
}

// const toolNameMapText = {
//   web_search: i18n.t('message.searching')
// }
// const toolDoneNameMapText = (args: Record<string, any>) => {
//   const count = args.count ?? 0
//   return i18n.t('message.websearch.fetch_complete', { count })
// }

// const PrepareTool = ({ toolResponse }: { toolResponse: MCPToolResponse }) => {
//   const toolNameText = useMemo(
//     () => toolNameMapText[toolResponse.tool.name] || toolResponse.tool.name,
//     [toolResponse.tool]
//   )

//   return (
//     <Spinner
//       text={
//         <PrepareToolWrapper>
//           {toolNameText}
//           <span>{JSON.stringify(toolResponse.arguments)}</span>
//         </PrepareToolWrapper>
//       }
//     />
//   )
// }

// const DoneTool = ({ toolResponse }: { toolResponse: MCPToolResponse }) => {
//   const toolDoneNameText = useMemo(
//     () => toolDoneNameMapText({ count: toolResponse.response?.data?.length ?? 0 }),
//     [toolResponse.response]
//   )
//   return <p>{toolDoneNameText}</p>
// }

export default function MessageTool({ block }: Props) {
  const toolResponse = block.metadata?.rawMcpToolResponse
  if (!toolResponse) return null
  console.log('toolResponse', toolResponse)

  return (
    <Collapse
      items={[
        {
          key: '1',
          label: <MessageWebSearchToolTitle toolResponse={toolResponse} />,
          children: <MessageWebSearchToolBody toolResponse={toolResponse} />,
          showArrow: false,
          styles: {
            header: {
              paddingLeft: '0'
            }
          }
        }
      ]}
      size="small"
      ghost
    />
  )
}
// const PrepareToolWrapper = styled.span`
//   display: flex;
//   align-items: center;
//   gap: 4px;
//   font-size: 14px;
//   padding-left: 0;
// `
