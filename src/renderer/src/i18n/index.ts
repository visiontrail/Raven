import { loggerService } from '@logger'
import { defaultLanguage } from '@shared/config/constant'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Original translation
import enUS from './locales/en-us.json'
import jaJP from './locales/ja-jp.json'
import ruRU from './locales/ru-ru.json'
import zhCN from './locales/zh-cn.json'
import zhTW from './locales/zh-tw.json'
// Machine translation
import elGR from './translate/el-gr.json'
import esES from './translate/es-es.json'
import frFR from './translate/fr-fr.json'
import ptPT from './translate/pt-pt.json'

const logger = loggerService.withContext('I18N')

const resources = Object.fromEntries(
  [
    ['en-US', enUS],
    ['ja-JP', jaJP],
    ['ru-RU', ruRU],
    ['zh-CN', zhCN],
    ['zh-TW', zhTW],
    ['el-GR', elGR],
    ['es-ES', esES],
    ['fr-FR', frFR],
    ['pt-PT', ptPT]
  ].map(([locale, translation]) => [locale, { translation }])
)

export const normalizeLanguage = (lang: string): string => {
  const l = (lang || '').toLowerCase()
  if (!l) return defaultLanguage
  if (l.startsWith('en')) return 'en-US'
  if (l.startsWith('zh-cn') || l === 'zh' || l.startsWith('zh-hans')) return 'zh-CN'
  if (l.startsWith('zh-tw') || l.startsWith('zh-hant') || l.startsWith('zh-hk')) return 'zh-TW'
  if (l.startsWith('ja')) return 'ja-JP'
  if (l.startsWith('ru')) return 'ru-RU'
  if (l.startsWith('el')) return 'el-GR'
  if (l.startsWith('es')) return 'es-ES'
  if (l.startsWith('fr')) return 'fr-FR'
  if (l.startsWith('pt')) return 'pt-PT'
  return defaultLanguage
}

export const getLanguage = () => {
  const saved = localStorage.getItem('language')
  const nav = navigator.language
  return normalizeLanguage(saved || nav || defaultLanguage)
}

export const getLanguageCode = () => {
  return getLanguage().split('-')[0]
}

export const changeLanguageNormalized = (lang: string) => {
  return i18n.changeLanguage(normalizeLanguage(lang))
}

i18n.use(initReactI18next).init({
  resources,
  lng: getLanguage(),
  fallbackLng: defaultLanguage,
  interpolation: {
    escapeValue: false
  },
  saveMissing: true,
  missingKeyHandler: (_1, _2, key) => {
    logger.error(`Missing key: ${key}`)
  }
})

export default i18n
