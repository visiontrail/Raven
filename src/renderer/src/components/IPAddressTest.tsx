import { Button, Card, Space, Typography } from 'antd'
import { FC, useEffect, useState } from 'react'

import { ipAddressService } from '../services/IPAddressService'

const { Text, Title } = Typography

/**
 * IP地址服务测试组件
 * 用于测试IP地址变更时的自动更新机制
 */
const IPAddressTest: FC = () => {
  const [currentIP, setCurrentIP] = useState<string>('')
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('')

  useEffect(() => {
    // 初始化IP地址服务
    ipAddressService.initialize()

    // 获取初始IP地址
    setCurrentIP(ipAddressService.getCurrentIP())
    setLastUpdateTime(new Date().toLocaleTimeString())

    // 添加IP变更监听器
    const handleIPChange = (newIP: string) => {
      setCurrentIP(newIP)
      setLastUpdateTime(new Date().toLocaleTimeString())
      console.log('IP地址已更新:', newIP)
    }

    ipAddressService.addIPChangeListener(handleIPChange)

    // 清理函数
    return () => {
      ipAddressService.removeIPChangeListener(handleIPChange)
    }
  }, [])

  const handleRefreshIP = () => {
    ipAddressService.refreshIP()
  }

  const handleGetFTPConfig = () => {
    const ftpConfig = ipAddressService.getFTPConfig()
    console.log('当前FTP配置:', ftpConfig)
    alert(`当前FTP配置:\n${JSON.stringify(ftpConfig, null, 2)}`)
  }

  return (
    <Card title="IP地址服务测试" style={{ maxWidth: 500, margin: '20px auto' }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Title level={5}>当前IP地址:</Title>
          <Text code style={{ fontSize: '16px' }}>
            {currentIP}
          </Text>
        </div>

        <div>
          <Title level={5}>最后更新时间:</Title>
          <Text>{lastUpdateTime}</Text>
        </div>

        <div>
          <Title level={5}>默认IP地址:</Title>
          <Text code>{ipAddressService.getDefaultIP()}</Text>
        </div>

        <div>
          <Title level={5}>服务状态:</Title>
          <Text type={ipAddressService.isServiceInitialized() ? 'success' : 'danger'}>
            {ipAddressService.isServiceInitialized() ? '已初始化' : '未初始化'}
          </Text>
        </div>

        <Space>
          <Button type="primary" onClick={handleRefreshIP}>
            刷新IP地址
          </Button>
          <Button onClick={handleGetFTPConfig}>获取FTP配置</Button>
        </Space>

        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <Title level={5}>使用说明:</Title>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>该组件会自动监听MCP配置变化</li>
            <li>当MCP服务器配置中的IP地址发生变化时，会自动更新显示</li>
            <li>点击"刷新IP地址"可以手动触发更新</li>
            <li>点击"获取FTP配置"可以查看当前的FTP配置</li>
          </ul>
        </div>
      </Space>
    </Card>
  )
}

export default IPAddressTest
