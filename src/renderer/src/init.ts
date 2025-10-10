import KeyvStorage from '@kangfenmao/keyv-storage'
import { loggerService } from '@logger'

import { startAutoSync } from './services/BackupService'
import { deviceLogMonitorService } from './services/DeviceLogMonitorService'
import { startNutstoreAutoSync } from './services/NutstoreService'
import storeSyncService from './services/StoreSyncService'
import { webTraceService } from './services/WebTraceService'
import store from './store'

loggerService.initWindowSource('mainWindow')

function initKeyv() {
  window.keyv = new KeyvStorage()
  window.keyv.init()
}

function initAutoSync() {
  setTimeout(() => {
    const { webdavAutoSync, localBackupAutoSync, s3 } = store.getState().settings
    const { nutstoreAutoSync } = store.getState().nutstore
    if (webdavAutoSync || (s3 && s3.autoSync) || localBackupAutoSync) {
      startAutoSync()
    }
    if (nutstoreAutoSync) {
      startNutstoreAutoSync()
    }
  }, 8000)
}

function initStoreSync() {
  storeSyncService.subscribe()
}

function initWebTrace() {
  webTraceService.init()
}

function initDeviceLogMonitor() {
  // 延迟启动设备日志监控服务，确保应用完全加载
  setTimeout(() => {
    deviceLogMonitorService.initialize().catch((error) => {
      loggerService.error('Failed to initialize device log monitor service:', error as Error)
    })
  }, 3000) // 3秒后启动
}

initKeyv()
initAutoSync()
initStoreSync()
initWebTrace()
initDeviceLogMonitor()
