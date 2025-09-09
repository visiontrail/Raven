import { Form, Input, Modal, Select, Switch } from 'antd'
import { DynamicIcon } from 'lucide-react/dynamic'
import { MessageSquareHeart } from 'lucide-react'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'

import { useAssistants } from '@renderer/hooks/useAssistant'
import type { ActionItem } from '@renderer/types/selectionTypes'

const { TextArea } = Input
const { Option } = Select

// Common icons for actions
const COMMON_ICONS = [
  'wand-sparkles',
  'edit-3',
  'file-text',
  'search',
  'translate',
  'lightbulb',
  'zap',
  'star',
  'heart',
  'bookmark',
  'tag',
  'message-square',
  'send',
  'share',
  'copy',
  'scissors',
  'eye',
  'download',
  'upload',
  'refresh-cw'
]

interface SelectionActionUserModalProps {
  open: boolean
  isModalOpen: boolean
  editingAction: ActionItem | null
  onOk: (action: ActionItem) => void
  onCancel: () => void
}

const SelectionActionUserModal: FC<SelectionActionUserModalProps> = ({
  open,
  isModalOpen,
  editingAction,
  onOk,
  onCancel
}) => {
  const { t } = useTranslation()
  const { assistants } = useAssistants()
  const [form] = Form.useForm()
  const [selectedIcon, setSelectedIcon] = useState<string>('wand-sparkles')

  useEffect(() => {
    const modalOpen = open || isModalOpen
    if (modalOpen) {
      if (editingAction) {
        form.setFieldsValue({
          name: editingAction.name,
          prompt: editingAction.prompt || '',
          assistantId: editingAction.assistantId || '',
          enabled: editingAction.enabled
        })
        setSelectedIcon(editingAction.icon || 'wand-sparkles')
      } else {
        form.resetFields()
        form.setFieldsValue({
          enabled: true
        })
        setSelectedIcon('wand-sparkles')
      }
    }
  }, [open, isModalOpen, editingAction, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const actionItem: ActionItem = {
        id: editingAction?.id || uuidv4(),
        name: values.name,
        enabled: values.enabled,
        isBuiltIn: false,
        icon: selectedIcon,
        prompt: values.prompt,
        assistantId: values.assistantId
      }
      onOk(actionItem)
    } catch (error) {
      console.error('Validation failed:', error)
    }
  }

  const renderIconOption = (icon: string) => (
    <Option key={icon} value={icon}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <DynamicIcon name={icon as any} size={16} fallback={() => <MessageSquareHeart size={16} />} />
        <span>{icon}</span>
      </div>
    </Option>
  )

  return (
    <Modal
      title={editingAction ? t('selection.settings.actions.edit') : t('selection.settings.actions.add')}
      open={open || isModalOpen}
      onOk={handleOk}
      onCancel={onCancel}
      width={500}
      destroyOnClose>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          enabled: true
        }}>
        <Form.Item
          name="name"
          label={t('selection.settings.actions.name')}
          rules={[
            { required: true, message: t('selection.settings.actions.name_required') },
            { max: 50, message: t('selection.settings.actions.name_max_length') }
          ]}>
          <Input placeholder={t('selection.settings.actions.name_placeholder')} />
        </Form.Item>

        <Form.Item name="icon" label={t('selection.settings.actions.icon')}>
          <Select
            value={selectedIcon}
            onChange={setSelectedIcon}
            showSearch
            placeholder={t('selection.settings.actions.icon_placeholder')}
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children as any)?.props?.children?.[1]?.props?.children
                ?.toLowerCase()
                ?.includes(input.toLowerCase())
            }>
            {COMMON_ICONS.map(renderIconOption)}
          </Select>
        </Form.Item>

        <Form.Item
          name="prompt"
          label={t('selection.settings.actions.prompt')}
          extra={t('selection.settings.actions.prompt_help')}>
          <TextArea
            rows={4}
            placeholder={t('selection.settings.actions.prompt_placeholder')}
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="assistantId"
          label={t('selection.settings.actions.assistant')}
          extra={t('selection.settings.actions.assistant_help')}>
          <Select placeholder={t('selection.settings.actions.assistant_placeholder')} allowClear>
            {assistants.map((assistant) => (
              <Option key={assistant.id} value={assistant.id}>
                {assistant.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="enabled" label={t('selection.settings.actions.enabled')} valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default SelectionActionUserModal
