import { computed } from 'vue'

const matchesQuery = (item, normalizedQuery) => {
  return item.name.toLowerCase().includes(normalizedQuery) || (item.group && item.group.toLowerCase().includes(normalizedQuery))
}

const isFailingNow = (item) => {
  if (!item.results || item.results.length === 0) {
    return false
  }
  return !item.results[item.results.length - 1].success
}

const hasRecentFailures = (item) => {
  if (!item.results || item.results.length === 0) {
    return false
  }
  return item.results.some((result) => !result.success)
}

const sortByHealth = (items) => {
  items.sort((left, right) => {
    const leftHealthy = left.results && left.results.length > 0 && left.results[left.results.length - 1].success
    const rightHealthy = right.results && right.results.length > 0 && right.results[right.results.length - 1].success
    if (!leftHealthy && rightHealthy) {
      return -1
    }
    if (leftHealthy && !rightHealthy) {
      return 1
    }
    return left.name.localeCompare(right.name)
  })
  return items
}

const applyFilters = (items, query, showOnlyFailing, showRecentFailures, sortBy) => {
  let filtered = [...items]
  const normalizedQuery = query.trim().toLowerCase()

  if (normalizedQuery) {
    filtered = filtered.filter((item) => matchesQuery(item, normalizedQuery))
  }
  if (showOnlyFailing) {
    filtered = filtered.filter((item) => isFailingNow(item))
  }
  if (showRecentFailures) {
    filtered = filtered.filter((item) => hasRecentFailures(item))
  }
  if (sortBy === 'health') {
    filtered = sortByHealth(filtered)
  }

  return filtered
}

const sortGroupNames = (groups) => {
  return groups.sort((left, right) => {
    if (left === 'No Group') {
      return 1
    }
    if (right === 'No Group') {
      return -1
    }
    return left.localeCompare(right)
  })
}

export const useHomeFilters = ({
  endpointStatuses,
  suiteStatuses,
  searchQuery,
  showOnlyFailing,
  showRecentFailures,
  sortBy,
  groupByGroup
}) => {
  const filteredEndpoints = computed(() => {
    return applyFilters(
      endpointStatuses.value,
      searchQuery.value,
      showOnlyFailing.value,
      showRecentFailures.value,
      sortBy.value
    )
  })

  const filteredSuites = computed(() => {
    return applyFilters(
      suiteStatuses.value || [],
      searchQuery.value,
      showOnlyFailing.value,
      showRecentFailures.value,
      sortBy.value
    )
  })

  const combinedGroups = computed(() => {
    if (!groupByGroup.value) {
      return null
    }

    const combined = {}
    filteredEndpoints.value.forEach((endpoint) => {
      const groupName = endpoint.group || 'No Group'
      if (!combined[groupName]) {
        combined[groupName] = { endpoints: [], suites: [] }
      }
      combined[groupName].endpoints.push(endpoint)
    })

    filteredSuites.value.forEach((suite) => {
      const groupName = suite.group || 'No Group'
      if (!combined[groupName]) {
        combined[groupName] = { endpoints: [], suites: [] }
      }
      combined[groupName].suites.push(suite)
    })

    const sortedGroupNames = sortGroupNames(Object.keys(combined))
    const groupedResult = {}
    sortedGroupNames.forEach((groupName) => {
      groupedResult[groupName] = combined[groupName]
    })

    return groupedResult
  })

  const calculateUnhealthyCount = (endpoints) => {
    return endpoints.filter((endpoint) => isFailingNow(endpoint)).length
  }

  const calculateFailingSuitesCount = (suites) => {
    return suites.filter((suite) => isFailingNow(suite)).length
  }

  return {
    filteredEndpoints,
    filteredSuites,
    combinedGroups,
    calculateUnhealthyCount,
    calculateFailingSuitesCount
  }
}
