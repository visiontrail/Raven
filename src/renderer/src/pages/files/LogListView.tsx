import { FC } from 'react'
import { useTranslation } from 'react-i18next'

import ServerIframeView from './ServerIframeView'

interface LogListViewProps {}

const LogListView: FC<LogListViewProps> = () => {
  const { t } = useTranslation()

  return (
    <ServerIframeView
      title={t('files.logs')}
      path="/logs?embed=1"
      iframeId="log-iframe"
      loadingText={t('files.loading_logs')}
      errorText={t('files.error_loading_logs')}
      refreshLabel={t('common.refresh')}
      retryLabel={t('common.retry')}
    />
  )
}

export default LogListView
