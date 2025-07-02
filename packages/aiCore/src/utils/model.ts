export function isOpenAIChatCompletionOnlyModel(modelId: string): boolean {
  if (!modelId) {
    return false
  }

  return (
    modelId.includes('gpt-4o-search-preview') ||
    modelId.includes('gpt-4o-mini-search-preview') ||
    modelId.includes('o1-mini') ||
    modelId.includes('o1-preview')
  )
}
