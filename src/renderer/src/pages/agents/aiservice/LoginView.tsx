import { Alert, Button, Input, Tag } from 'antd'
import { LogIn } from 'lucide-react'
import { FC, useState } from 'react'
import styled from 'styled-components'

interface Props {
  baseUrl: string
  loading: boolean
  error: string | null
  onLogin: (username: string, password: string) => void
}

const LoginView: FC<Props> = ({ baseUrl, loading, error, onLogin }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const submit = () => {
    if (!username.trim() || !password) return
    onLogin(username.trim(), password)
  }

  return (
    <Wrap>
      <Card>
        <IconCircle>
          <LogIn size={22} />
        </IconCircle>
        <CardTitle>登录 RavenAIService</CardTitle>
        <CardSub>登录后即可使用智能体并同步你的会话历史。</CardSub>

        <ConnRow>
          <span>服务地址</span>
          <Tag color="blue" style={{ margin: 0 }}>
            {baseUrl || '未配置'}
          </Tag>
        </ConnRow>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}

        <Field>
          <Input
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onPressEnter={submit}
            autoFocus
          />
        </Field>
        <Field>
          <Input.Password
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={submit}
          />
        </Field>

        <Button type="primary" block loading={loading} disabled={!username.trim() || !password} onClick={submit}>
          登录
        </Button>
      </Card>
    </Wrap>
  )
}

const Wrap = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`

const Card = styled.div`
  width: 360px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: center;
`

const IconCircle = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--color-primary);
  color: #fff;
  display: grid;
  place-items: center;
  margin: 0 auto 14px;
`

const CardTitle = styled.h2`
  font-size: 19px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0 0 6px;
`

const CardSub = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  margin-bottom: 18px;
`

const ConnRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--color-text-3);
  padding: 8px 10px;
  background: var(--color-background-soft);
  border-radius: 8px;
  margin-bottom: 16px;
`

const Field = styled.div`
  margin-bottom: 12px;
  text-align: left;
`

export default LoginView
