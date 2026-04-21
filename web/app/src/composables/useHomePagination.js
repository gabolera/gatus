import { computed } from 'vue'

export const useHomePagination = ({
  filteredEndpoints,
  filteredSuites,
  groupByGroup,
  currentPage,
  itemsPerPage
}) => {
  const totalPages = computed(() => {
    const totalItems = filteredEndpoints.value.length + filteredSuites.value.length
    return Math.ceil(totalItems / itemsPerPage.value)
  })

  const paginatedEndpoints = computed(() => {
    if (groupByGroup.value) {
      return filteredEndpoints.value
    }
    const start = (currentPage.value - 1) * itemsPerPage.value
    const end = start + itemsPerPage.value
    return filteredEndpoints.value.slice(start, end)
  })

  const paginatedSuites = computed(() => {
    if (groupByGroup.value) {
      return filteredSuites.value
    }
    const start = (currentPage.value - 1) * itemsPerPage.value
    const end = start + itemsPerPage.value
    return filteredSuites.value.slice(start, end)
  })

  const visiblePages = computed(() => {
    const pages = []
    const maxVisiblePages = 5
    let start = Math.max(1, currentPage.value - Math.floor(maxVisiblePages / 2))
    let end = Math.min(totalPages.value, start + maxVisiblePages - 1)

    if (end - start < maxVisiblePages - 1) {
      start = Math.max(1, end - maxVisiblePages + 1)
    }

    for (let page = start; page <= end; page++) {
      pages.push(page)
    }
    return pages
  })

  return {
    totalPages,
    paginatedEndpoints,
    paginatedSuites,
    visiblePages
  }
}
