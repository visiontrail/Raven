import type { AIServiceAgentKind, ProjectRepoOption } from '@renderer/types/aiServiceAgent'
import { Input, Select, Tooltip } from 'antd'
import { Paperclip, Send, Square, X } from 'lucide-react'
import { FC, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ACCEPTED_LOG_EXTENSIONS, AGENT_META_BY_KIND } from './agentMeta'

const { TextArea } = Input

interface Props {
  agentKind: AIServiceAgentKind
  projectRepos: ProjectRepoOption[]
  projectRepoId: number | null
  onProjectRepoChange: (id: number | null) => void
  projectsLoading: boolean
  selectedFile: File | null
  onFileChange: (file: File | null) => void
  value: string
  onChange: (v: string) => void
  isSending: boolean
  onSend: () => void
  onStop: () => void
  disabled?: boolean
}

const Composer: FC<Props> = ({
  agentKind,
  projectRepos,
  projectRepoId,
  onProjectRepoChange,
  projectsLoading,
  selectedFile,
  onFileChange,
  value,
  onChange,
  isSending,
  onSend,
  onStop,
  disabled
}) => {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const meta = AGENT_META_BY_KIND[agentKind]
  const projectRequired = meta.projectRepo === 'required'
  const canSend = !disabled && (!!value.trim() || (meta.supportsFile && !!selectedFile))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (isSending) return
      if (canSend) onSend()
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileChange(file)
    e.target.value = ''
  }

  return (
    <Wrap>
      <Box>
        {selectedFile && (
          <FileChip>
            <Paperclip size={13} />
            <span>{selectedFile.name}</span>
            <button
              type="button"
              onClick={() => onFileChange(null)}
              aria-label={t('agents.aiservice.composer.remove_file')}>
              <X size={12} />
            </button>
          </FileChip>
        )}

        <TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            meta.supportsFile
              ? t('agents.aiservice.composer.placeholder_with_file')
              : t('agents.aiservice.composer.placeholder')
          }
          autoSize={{ minRows: 2, maxRows: 8 }}
          variant="borderless"
          disabled={disabled}
        />

        <Row>
          {meta.supportsFile && (
            <>
              <Tooltip title={t('agents.aiservice.composer.upload_tooltip')}>
                <IconBtn type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
                  <Paperclip size={15} />
                </IconBtn>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_LOG_EXTENSIONS}
                style={{ display: 'none' }}
                onChange={handleFile}
              />
            </>
          )}

          <Select
            size="small"
            placeholder={
              projectRequired
                ? t('agents.aiservice.composer.project_required_placeholder')
                : t('agents.aiservice.composer.project_optional_placeholder')
            }
            value={projectRepoId}
            onChange={(v) => onProjectRepoChange(v ?? null)}
            options={projectRepos.map((r) => ({ value: r.id, label: `${r.project_name}（${r.project_code}）` }))}
            loading={projectsLoading}
            allowClear
            showSearch
            optionFilterProp="label"
            status={projectRequired && projectRepoId == null ? 'warning' : undefined}
            style={{ minWidth: 180, flex: '0 1 240px' }}
            disabled={disabled}
          />

          <Spacer />

          {isSending ? (
            <SendBtn type="button" $stop onClick={onStop}>
              <Square size={15} fill="currentColor" />
            </SendBtn>
          ) : (
            <SendBtn type="button" onClick={onSend} disabled={!canSend}>
              <Send size={15} />
            </SendBtn>
          )}
        </Row>
      </Box>
      <Hint>{t('agents.aiservice.composer.disclaimer')}</Hint>
    </Wrap>
  )
}

const Wrap = styled.div`
  padding: 10px 24px 14px;
  flex-shrink: 0;
`

const Box = styled.div`
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 8px 10px 8px 12px;
  background: var(--color-background);
  display: flex;
  flex-direction: column;
  gap: 6px;

  &:focus-within {
    border-color: var(--color-primary);
  }
`

const FileChip = styled.div`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: var(--color-background-soft);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-text-2);
  max-width: 100%;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 240px;
  }
  button {
    display: inline-flex;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text-3);
    padding: 0;
  }
`

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`

const IconBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--color-text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--color-background-soft);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const Spacer = styled.div`
  flex: 1;
`

const SendBtn = styled.button<{ $stop?: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 9px;
  border: none;
  background: ${({ $stop }) => ($stop ? 'var(--color-error)' : 'var(--color-primary)')};
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

const Hint = styled.div`
  text-align: center;
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 6px;
`

export default Composer
