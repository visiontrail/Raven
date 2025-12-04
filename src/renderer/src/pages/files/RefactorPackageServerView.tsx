import { Package } from 'lucide-react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

import ServerIframeView from './ServerIframeView'

interface RefactorPackageServerViewProps {}

const RefactorPackageServerView: FC<RefactorPackageServerViewProps> = () => {
  const { t } = useTranslation()

  return (
    <ServerIframeView
      title="重构包服务器"
      url="http://172.16.9.224:8083/"
      iframeId="refactor-package-iframe"
      loadingText="正在加载重构包服务器..."
      errorText="重构包服务器加载失败"
      refreshLabel={t('common.refresh')}
      retryLabel={t('common.retry')}
      icon={<Package size={16} />}
    />
  )
}

export default RefactorPackageServerView
