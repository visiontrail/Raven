// import { isWebSearchModel } from '@renderer/config/models'
// import { Model } from '@renderer/types'
// // import {} from '@cherrystudio/ai-core'

// // The tool name for Gemini search can be arbitrary, but let's use a descriptive one.
// const GEMINI_SEARCH_TOOL_NAME = 'google_search'

// export function getWebSearchTools(model: Model): Record<string, any> {
//   if (!isWebSearchModel(model)) {
//     return {}
//   }

//   // Use provider from model if available, otherwise fallback to parsing model id.
//   const provider = model.provider || model.id.split('/')[0]

//   switch (provider) {
//     case 'anthropic':
//       return {
//         web_search: {
//           type: 'web_search_20250305',
//           name: 'web_search',
//           max_uses: 5
//         }
//       }
//     case 'google':
//     case 'gemini':
//       return {
//         [GEMINI_SEARCH_TOOL_NAME]: {
//           googleSearch: {}
//         }
//       }
//     default:
//       // For OpenAI and others, web search is often a parameter, not a tool.
//       // The logic is handled in `buildProviderOptions`.
//       return {}
//   }
// }
