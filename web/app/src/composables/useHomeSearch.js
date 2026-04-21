import { onUnmounted, ref, watch } from 'vue'

export const useHomeSearch = ({ debounceMs = 300 } = {}) => {
  const searchInput = ref('')
  const debouncedQuery = ref('')
  let debounceTimeout = null
  let activeController = null

  const clearDebounce = () => {
    if (!debounceTimeout) {
      return
    }
    clearTimeout(debounceTimeout)
    debounceTimeout = null
  }

  const cancelPendingRequest = () => {
    if (!activeController) {
      return
    }
    activeController.abort()
    activeController = null
  }

  const createRequestSignal = () => {
    cancelPendingRequest()
    activeController = new AbortController()
    return activeController.signal
  }

  watch(searchInput, (value) => {
    clearDebounce()
    debounceTimeout = setTimeout(() => {
      debouncedQuery.value = value
      debounceTimeout = null
    }, debounceMs)
  })

  onUnmounted(() => {
    clearDebounce()
    cancelPendingRequest()
  })

  return {
    searchInput,
    debouncedQuery,
    createRequestSignal,
    cancelPendingRequest
  }
}
