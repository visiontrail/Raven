import { FC } from 'react'
import { useTranslation } from 'react-i18next'

import ServerIframeView from './ServerIframeView'

interface LogListViewProps {}

const LogListView: FC<LogListViewProps> = () => {
  const { t } = useTranslation()

  return (
    <ServerIframeView
      title={t('files.logs')}
      url="http://172.16.9.224:8085/logs"
      iframeId="log-iframe"
      loadingText={t('files.loading_logs')}
      errorText={t('files.error_loading_logs')}
      refreshLabel={t('common.refresh')}
      retryLabel={t('common.retry')}
    />
  )
}

export default LogListView
