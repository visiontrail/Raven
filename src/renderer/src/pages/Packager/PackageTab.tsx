import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  message,
  Progress,
  Row,
  Space,
  Typography
} from 'antd'
import React, { useEffect, useReducer, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

const { TextArea } = Input
const { Title, Text } = Typography

// --- State and Reducer Definition ---

interface Component {
  name: string
  description: string
}

interface ComponentState {
  component: Component
  selectedFilePath?: string
  version?: string
  fileName?: string
}

interface PackagerState {
  packageVersion: string
  isPatch: boolean
  components: ComponentState[]
}

type PackagerAction =
  | { type: 'SET_COMPONENTS'; payload: Component[] }
  | { type: 'SET_PACKAGE_VERSION'; payload: string }
  | { type: 'SET_IS_PATCH'; payload: boolean }
  | {
      type: 'SET_FILE'
      payload: {
        componentName: string
        filePath?: string
        fileName?: string
        version?: string
      }
    }
  | { type: 'SET_VERSION'; payload: { componentName: string; version: string } }
  | { type: 'RESET_FIELDS' }

const initialState: PackagerState = {
  packageVersion: '',
  isPatch: false,
  components: []
}

function packagerReducer(state: PackagerState, action: PackagerAction): PackagerState {
  switch (action.type) {
    case 'SET_COMPONENTS':
      return { ...initialState, components: action.payload.map((c) => ({ component: c })) }
    case 'SET_PACKAGE_VERSION':
      return { ...state, packageVersion: action.payload }
    case 'SET_IS_PATCH':
      return { ...state, isPatch: action.payload }
    case 'SET_FILE':
      return {
        ...state,
        components: state.components.map((c) =>
          c.component.name === action.payload.componentName
            ? {
                ...c,
                selectedFilePath: action.payload.filePath,
                fileName: action.payload.fileName,
                version: action.payload.version
              }
            : c
        )
      }
    case 'SET_VERSION':
      return {
        ...state,
        components: state.components.map((c) =>
          c.component.name === action.payload.componentName ? { ...c, version: action.payload.version } : c
        )
      }
    case 'RESET_FIELDS':
      return {
        ...initialState,
        components: state.components.map((c) => ({
          component: c.component,
          version: undefined,
          selectedFilePath: undefined,
          fileName: undefined
        }))
      }
    default:
      return state
  }
}

// --- Component Definition ---

const PackageTab: React.FC = () => {
  const { packageType } = useParams<{ packageType: string }>()
  const { t } = useTranslation()
  const [state, dispatch] = useReducer(packagerReducer, initialState)
  const { packageVersion, isPatch, components } = state

  const [siIniPreview, setSiIniPreview] = useState('')
  const [log, setLog] = useState('')
  const [packaging, setPackaging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [packageVersionError, setPackageVersionError] = useState(false)

  // Effect to fetch component definitions when packageType changes
  useEffect(() => {
    if (!packageType) return
    const fetchComponents = async () => {
      try {
        const componentDefs = await window.api.packager.getInfo(packageType)
        dispatch({ type: 'SET_COMPONENTS', payload: componentDefs })
      } catch (error) {
        message.error(`获取组件信息失败: ${error.message}`)
      }
    }
    fetchComponents()
  }, [packageType])

  // Effect to update the preview whenever the state changes
  useEffect(() => {
    const updatePreview = async () => {
      if (!packageType) return
      const config = {
        package_type: packageType,
        package_version: packageVersion,
        is_patch: isPatch,
        selected_components: components.map((c) => ({
          name: c.component.name,
          description: c.component.description,
          selected_file: c.selectedFilePath,
          version: c.version
        }))
      }
      console.log('[Renderer] Generating si.ini preview with config:', JSON.stringify(config, null, 2))
      try {
        const preview = await window.api.packager.generateSiIni(config)
        setSiIniPreview(preview)
        console.log('[Renderer] si.ini preview updated.')
      } catch (error) {
        const errorMessage = `预览生成失败: ${error.message}`
        setSiIniPreview(errorMessage)
        console.error('[Renderer] Error generating si.ini preview:', error)
      }
    }
    updatePreview()
  }, [packageVersion, isPatch, components, packageType])

  const handleLog = (msg: string) => {
    setLog((prev) => `${prev}[${new Date().toLocaleTimeString()}] ${msg}
`)
  }

  const handleSelectFile = async (componentName: string) => {
    try {
      const filePath = await window.api.packager.selectFile()
      if (!filePath) {
        console.log('[Renderer] No file selected.')
        return
      }

      const fileName = window.api.path.basename(filePath)
      console.log(`[Renderer] File selected for ${componentName}: ${fileName} at path: ${filePath}`)

      let detectedVersion: string | undefined
      try {
        console.log(`[Renderer] Calling getAutoVersionFromFilename with name: ${fileName}`)
        detectedVersion = (await window.api.packager.getAutoVersionFromFilename(fileName)) || undefined
        console.log(`[Renderer] Detected version for ${componentName}: ${detectedVersion}`)
      } catch (error) {
        console.error('[Renderer] Failed to get auto version', error)
        message.error(t('packager.error.autoVersion'))
      }

      dispatch({
        type: 'SET_FILE',
        payload: { componentName, filePath, fileName, version: detectedVersion }
      })
    } catch (error) {
      message.error(`${t('packager.error.selectFile')}: ${error.message}`)
      console.error('[Renderer] Error selecting file:', error)
    }
  }

  const handleClearFile = (componentName: string) => {
    dispatch({
      type: 'SET_FILE',
      payload: {
        componentName,
        filePath: undefined,
        fileName: undefined,
        version: undefined
      }
    })
  }

  const handleStartPackaging = async () => {
    if (!packageType) {
      message.error(t('packager.error.noPackageType'))
      return
    }
    if (!packageVersion) {
      message.error(t('packager.error.noPackageVersion'))
      setPackageVersionError(true)
      return
    }
    const selectedComponents = components.filter((c) => c.selectedFilePath)
    if (selectedComponents.length === 0) {
      message.error(t('packager.error.noComponents'))
      return
    }

    setPackaging(true)
    setProgress(0)
    handleLog(t('packager.log.start'))

    const config = {
      package_type: packageType,
      package_version: packageVersion,
      is_patch: isPatch,
      selected_components: selectedComponents.map((c) => ({
        name: c.component.name,
        description: t(c.component.description),
        selected_file: c.selectedFilePath,
        version: c.version
      }))
    }

    try {
      // This is a simplified progress simulation.
      // A real implementation would require more complex IPC communication for progress updates.
      setProgress(30)
      const result = await window.api.packager.createPackage(config)
      setProgress(100)

      if (result.success) {
        message.success(result.message)
        handleLog(`${t('packager.log.success')} ${result.outputPath}`)
        if (result.outputPath) {
          window.api.openPath(result.outputPath)
        }
      } else {
        message.error(result.message)
        handleLog(`${t('packager.log.failure')}: ${result.message}`)
      }
    } catch (error) {
      const errorMessage = `${t('packager.log.errorUnknown')}: ${error.message}`
      message.error(errorMessage)
      handleLog(errorMessage)
      console.error('[Renderer] Packaging error:', error)
    } finally {
      setPackaging(false)
    }
  }

  const handleClear = () => {
    dispatch({ type: 'RESET_FIELDS' })
    setLog('')
    handleLog(t('packager.log.cleared'))
  }

  return (
    <Row gutter={16} style={{ width: '100%' }}>
      <Col span={14}>
        <Card title={t('packager.controlPanel')}>
          {packageType === 'config' && (
            <Typography.Paragraph type="secondary" style={{ marginTop: '-10px', marginBottom: '20px' }}>
              {t('packager.configDescription')}
            </Typography.Paragraph>
          )}
          <Form layout="vertical">
            <Form.Item label={t('packager.packageVersion')} required>
              <Input
                placeholder={t('packager.versionPlaceholder')}
                value={packageVersion}
                status={packageVersionError ? 'error' : ''}
                onChange={(e) => {
                  if (packageVersionError) setPackageVersionError(false)
                  dispatch({ type: 'SET_PACKAGE_VERSION', payload: e.target.value })
                }}
              />
            </Form.Item>
            <Card title={t('packager.componentSelection')} type="inner">
              {components.map((compState) => (
                <Form.Item key={compState.component.name} label={t(compState.component.description)}>
                  <Row gutter={8} align="middle">
                    <Col span={19}>
                      <Space>
                        <Button
                          icon={<UploadOutlined />}
                          onClick={() => handleSelectFile(compState.component.name)}
                        >
                          {t('packager.selectFile')}
                        </Button>
                        {compState.fileName && (
                          <>
                            <Button
                              icon={<DeleteOutlined />}
                              onClick={() => handleClearFile(compState.component.name)}
                              size="small"
                              type="text"
                              danger
                            />
                            <Text ellipsis={{ tooltip: compState.selectedFilePath }}>
                              {compState.fileName}
                            </Text>
                          </>
                        )}
                      </Space>
                    </Col>
                    <Col span={5}>
                      <Input
                        placeholder={t('packager.versionInputPlaceholder')}
                        value={compState.version ?? ''}
                        onChange={(e) =>
                          dispatch({
                            type: 'SET_VERSION',
                            payload: {
                              componentName: compState.component.name,
                              version: e.target.value
                            }
                          })
                        }
                      />
                    </Col>
                  </Row>
                </Form.Item>
              ))}
            </Card>
            <Form.Item style={{ marginTop: 16 }}>
              <Checkbox
                checked={isPatch}
                onChange={(e) => dispatch({ type: 'SET_IS_PATCH', payload: e.target.checked })}
              >
                {t('packager.isPatch')}
              </Checkbox>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" onClick={handleStartPackaging} loading={packaging}>
                  {t('packager.startPackaging')}
                </Button>
                <Button onClick={handleClear}>
                  {t('packager.clearSelections')}
                </Button>
              </Space>
            </Form.Item>
            {packaging && (
              <Form.Item>
                <Progress percent={progress} />
              </Form.Item>
            )}
          </Form>
        </Card>
      </Col>
      <Col span={10}>
        <Card title={t('packager.infoPreview')}>
          <Title level={5}>{t('packager.operationLog')}</Title>
          <TextArea
            rows={8}
            value={log}
            readOnly
            style={{ marginBottom: 16, backgroundColor: '#f0f2f5' }}
          />
          <Title level={5}>{t('packager.siIniPreview')}</Title>
          <TextArea
            autoSize={{ minRows: 10 }}
            value={siIniPreview}
            readOnly
            style={{ fontFamily: 'monospace', backgroundColor: '#f0f2f5' }}
          />
        </Card>
      </Col>
    </Row>
  )
}

export default PackageTab

