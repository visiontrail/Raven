import { loggerService } from '@logger'
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, useStore } from 'react-redux'
import {
  createTransform,
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE
} from 'redux-persist'
import storage from 'redux-persist/lib/storage'

import storeSyncService from '../services/StoreSyncService'
import agents from './agents'
import assistants from './assistants'
import backup from './backup'
import codeTools from './codeTools'
import copilot from './copilot'
import inputToolsReducer from './inputTools'
import knowledge from './knowledge'
import llm from './llm'
import mcp from './mcp'
import memory from './memory'
import messageBlocksReducer from './messageBlock'
import migrate from './migrate'
import minapps from './minapps'
import newMessagesReducer from './newMessage'
import nutstore from './nutstore'
import paintings from './paintings'
import preprocess from './preprocess'
import runtime from './runtime'
import selectionStore from './selectionStore'
import settings from './settings'
import shortcuts from './shortcuts'
import tabs from './tabs'
import translate from './translate'
import websearch from './websearch'

const logger = loggerService.withContext('Store')

const rootReducer = combineReducers({
  assistants,
  agents,
  backup,
  codeTools,
  nutstore,
  paintings,
  llm,
  settings,
  runtime,
  shortcuts,
  knowledge,
  minapps,
  websearch,
  mcp,
  memory,
  copilot,
  selectionStore,
  tabs,
  preprocess,
  messages: newMessagesReducer,
  messageBlocks: messageBlocksReducer,
  inputTools: inputToolsReducer,
  translate
})

export type RootState = ReturnType<typeof rootReducer>

// Provider credentials are delivered by RavenAIService and live only in the
// dedicated runtime. Redact both writes and legacy rehydration as defense in
// depth; synchronized Redux provider metadata always carries an empty apiKey.
const redactLlmCredentials = (state: any) => ({
  ...state,
  providers: Array.isArray(state?.providers)
    ? state.providers.map((provider: any) => ({ ...provider, apiKey: '' }))
    : []
})

const llmCredentialRedactionTransform = createTransform(redactLlmCredentials, redactLlmCredentials, {
  whitelist: ['llm']
})

const persistedReducer = persistReducer<RootState>(
  {
    key: 'cherry-studio',
    storage,
    version: 136,
    blacklist: ['runtime', 'messages', 'messageBlocks', 'tabs'],
    transforms: [llmCredentialRedactionTransform],
    migrate
  },
  rootReducer
)

/**
 * Configures the store sync service to synchronize specific state slices across all windows.
 * For detailed implementation, see @renderer/services/StoreSyncService.ts
 *
 * Usage:
 * - 'xxxx/' - Synchronizes the entire state slice
 * - 'xxxx/sliceName' - Synchronizes a specific slice within the state
 *
 * To listen for store changes in a window:
 * Call storeSyncService.subscribe() in the window's entryPoint.tsx
 */
storeSyncService.setOptions({
  syncList: ['assistants/', 'settings/', 'llm/', 'selectionStore/']
})

const store = configureStore({
  // @ts-ignore store type is unknown
  reducer: persistedReducer as typeof rootReducer,
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
      }
    }).concat(storeSyncService.createMiddleware())
  },
  devTools: true
})

export type AppDispatch = typeof store.dispatch

export const persistor = persistStore(store)
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useAppStore = useStore.withTypes<typeof store>()
window.store = store

export async function handleSaveData() {
  logger.info('Flushing redux persistor data')
  await persistor.flush()
  logger.info('Flushed redux persistor data')
}

export default store
