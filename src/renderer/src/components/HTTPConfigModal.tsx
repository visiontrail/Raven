import { Form, Input, Modal, Select } from 'antd'
import { FC, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { HTTPConfig } from '../types/package'

interface HTTPConfigModalProps {
  visible: boolean
  onOk: (config: HTTPConfig) => void
  onCancel: () => void
  loading?: boolean
}

const HTTPConfigModal: FC<HTTPConfigModalProps> = ({ visible, onOk, onCancel, loading = false }) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()

  // Initialize form with default values
  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        url: 'http://172.16.9.224:8083/api/upload',
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        authType: 'none'
      })
    }
  }, [visible, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()

      // Build headers object
      const headers: Record<string, string> = {}
      if (values.customHeaders) {
        // Parse custom headers from textarea (format: key=value, one per line)
        const headerLines = values.customHeaders.split('\n').filter((line) => line.trim())
        headerLines.forEach((line) => {
          const [key, ...valueParts] = line.split('=')
          if (key && valueParts.length > 0) {
            headers[key.trim()] = valueParts.join('=').trim()
          }
        })
      }

      // Build authentication object
      let authentication: HTTPConfig['authentication'] = undefined
      if (values.authType !== 'none') {
        authentication = {
          type: values.authType
        }

        if (values.authType === 'Basic') {
          authentication.username = values.username
          authentication.password = values.password
        } else if (values.authType === 'Bearer' || values.authType === 'OAuth') {
          authentication.token = values.token
        }
      }

      const config: HTTPConfig = {
        url: values.url,
        method: values.method,
        headers,
        authentication
      }

      onOk(config)
    } catch (error) {
      console.error('Form validation failed:', error)
    }
  }

  const handleAuthTypeChange = () => {
    // Clear authentication fields when type changes
    form.setFieldsValue({
      username: undefined,
      password: undefined,
      token: undefined
    })
  }

  const authType = Form.useWatch('authType', form)

  return (
    <Modal
      title={t('files.package.http_config_modal.title')}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnClose
      centered
      transitionName="animation-move-down"
      width={600}>
      <Form form={form} layout="vertical" name="http_config_form">
        <Form.Item
          name="url"
          label={t('files.package.http_config_modal.url')}
          rules={[
            { required: true, message: t('files.package.http_config_modal.url_required') },
            { type: 'url', message: t('files.package.http_config_modal.url_invalid') }
          ]}>
          <Input placeholder="http://172.16.9.224:8083/api/upload" />
        </Form.Item>

        <Form.Item name="method" label={t('files.package.http_config_modal.method')} rules={[{ required: true }]}>
          <Select
            options={[
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' }
            ]}
          />
        </Form.Item>

        <Form.Item
          name="customHeaders"
          label={t('files.package.http_config_modal.headers')}
          tooltip={t('files.package.http_config_modal.headers_tooltip')}>
          <Input.TextArea
            rows={3}
            placeholder={`Authorization=Bearer your-token\nX-Custom-Header=value`}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item name="authType" label={t('files.package.http_config_modal.auth_type')}>
          <Select
            onChange={handleAuthTypeChange}
            options={[
              { label: t('files.package.http_config_modal.auth_none'), value: 'none' },
              { label: 'Basic Auth', value: 'Basic' },
              { label: 'Bearer Token', value: 'Bearer' },
              { label: 'OAuth Token', value: 'OAuth' }
            ]}
          />
        </Form.Item>

        {authType === 'Basic' && (
          <>
            <Form.Item
              name="username"
              label={t('files.package.http_config_modal.username')}
              rules={[{ required: true, message: t('files.package.http_config_modal.username_required') }]}>
              <Input placeholder={t('files.package.http_config_modal.username_placeholder')} />
            </Form.Item>
            <Form.Item
              name="password"
              label={t('files.package.http_config_modal.password')}
              rules={[{ required: true, message: t('files.package.http_config_modal.password_required') }]}>
              <Input.Password placeholder={t('files.package.http_config_modal.password_placeholder')} />
            </Form.Item>
          </>
        )}

        {(authType === 'Bearer' || authType === 'OAuth') && (
          <Form.Item
            name="token"
            label={t('files.package.http_config_modal.token')}
            rules={[{ required: true, message: t('files.package.http_config_modal.token_required') }]}>
            <Input.Password placeholder={t('files.package.http_config_modal.token_placeholder')} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export default HTTPConfigModal
