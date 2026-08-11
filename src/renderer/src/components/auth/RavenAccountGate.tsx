import { useRavenAccount } from '@renderer/context/RavenAccountContext'
import { Alert, Button, Input, Segmented, Spin, Tag } from 'antd'
import { Bot, LogIn, UserPlus } from 'lucide-react'
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

type AuthMode = 'login' | 'register'

export default function RavenAccountGate({ children }: PropsWithChildren) {
  const { t } = useTranslation()
  const { config, profile, booting, authenticating, error, login, register, retry } = useRavenAccount()
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setMode('login')
    setUsername('')
    setDisplayName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setLocalError(null)
  }, [profile])

  const valid = useMemo(() => {
    if (!username.trim() || !password) return false
    if (mode === 'register') {
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      return Boolean(username.trim().length >= 3 && validEmail && password.length >= 6 && password === confirmPassword)
    }
    return true
  }, [confirmPassword, email, mode, password, username])

  if (booting) {
    return (
      <Screen>
        <Spin size="large" />
        <Muted>{t('ravenAccount.booting')}</Muted>
      </Screen>
    )
  }

  if (profile) return children

  const submit = async () => {
    setLocalError(null)
    if (mode === 'register' && password !== confirmPassword) {
      setLocalError(t('ravenAccount.validation.password_mismatch'))
      return
    }
    try {
      if (mode === 'login') {
        await login(username.trim(), password)
      } else {
        await register({
          username: username.trim(),
          password,
          display_name: displayName.trim() || undefined,
          email: email.trim()
        })
      }
    } catch {
      // The context owns the server/connection error shown below.
    }
  }

  return (
    <Screen>
      <Card>
        <Brand>
          <BrandIcon>
            <Bot size={26} />
          </BrandIcon>
          <div>
            <Title>{t('ravenAccount.title')}</Title>
            <Subtitle>{t('ravenAccount.subtitle')}</Subtitle>
          </div>
        </Brand>

        <ServiceRow>
          <span>{t('ravenAccount.service')}</span>
          <Tag color="blue">{config?.baseUrl || t('ravenAccount.not_configured')}</Tag>
        </ServiceRow>

        <Segmented<AuthMode>
          block
          value={mode}
          onChange={setMode}
          options={[
            { value: 'login', label: t('ravenAccount.login_tab'), icon: <LogIn size={14} /> },
            { value: 'register', label: t('ravenAccount.register_tab'), icon: <UserPlus size={14} /> }
          ]}
        />

        <Form>
          <Input
            autoFocus
            autoComplete="username"
            placeholder={t('ravenAccount.username')}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          {mode === 'register' && (
            <>
              <Input
                placeholder={t('ravenAccount.display_name')}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <Input
                type="email"
                autoComplete="email"
                placeholder={t('ravenAccount.email')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </>
          )}
          <Input.Password
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={t('ravenAccount.password')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onPressEnter={() => valid && void submit()}
          />
          {mode === 'register' && (
            <Input.Password
              autoComplete="new-password"
              placeholder={t('ravenAccount.confirm_password')}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onPressEnter={() => valid && void submit()}
            />
          )}
        </Form>

        {(localError || error) && (
          <Alert
            type="error"
            showIcon
            message={localError || error}
            action={
              error ? (
                <Button size="small" onClick={() => void retry()}>
                  {t('common.retry')}
                </Button>
              ) : undefined
            }
          />
        )}

        <Button type="primary" size="large" block disabled={!valid} loading={authenticating} onClick={submit}>
          {mode === 'login' ? t('ravenAccount.login') : t('ravenAccount.register')}
        </Button>
        <Privacy>{t('ravenAccount.privacy')}</Privacy>
      </Card>
    </Screen>
  )
}

const Screen = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background:
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 42%),
    var(--color-background);
`

const Card = styled.div`
  width: min(430px, calc(100vw - 40px));
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: var(--color-background);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 16px;
  -webkit-app-region: no-drag;
`

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 13px;
`

const BrandIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: white;
  background: var(--color-primary);
`

const Title = styled.h1`
  margin: 0;
  color: var(--color-text-1);
  font-size: 21px;
`

const Subtitle = styled.div`
  color: var(--color-text-2);
  font-size: 13px;
  margin-top: 3px;
`

const ServiceRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text-3);
  font-size: 12px;
`

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const Privacy = styled.div`
  color: var(--color-text-3);
  font-size: 11.5px;
  line-height: 1.5;
  text-align: center;
`

const Muted = styled.div`
  color: var(--color-text-2);
`
