import { computed, ref, watch } from 'vue'

const DEFAULT_GROUP_STATE = 'idle'

const createCacheKey = (groupName, filterKey) => {
  return `${filterKey}::${groupName}`
}

const getDefaultHydrator = async (_groupName, groupData) => {
  return {
    endpoints: groupData.endpoints || [],
    suites: groupData.suites || []
  }
}

export const useHomeGroups = ({
  combinedGroups,
  filterCacheKey,
  hydrateGroupDetails = getDefaultHydrator
}) => {
  const uncollapsedGroups = ref(new Set())
  const groupStatusByName = ref({})
  const groupDetailsCache = ref({})

  const initializeCollapsedGroups = () => {
    try {
      const savedGroups = localStorage.getItem('gatus:uncollapsed-groups')
      if (savedGroups) {
        uncollapsedGroups.value = new Set(JSON.parse(savedGroups))
      }
    } catch (_error) {
      localStorage.removeItem('gatus:uncollapsed-groups')
      uncollapsedGroups.value = new Set()
    }
  }

  const persistUncollapsedGroups = () => {
    const serialized = Array.from(uncollapsedGroups.value)
    localStorage.setItem('gatus:uncollapsed-groups', JSON.stringify(serialized))
    localStorage.removeItem('gatus:collapsed-groups')
  }

  const getCachedGroupData = (groupName) => {
    return groupDetailsCache.value[createCacheKey(groupName, filterCacheKey.value)]
  }

  const setGroupState = (groupName, state) => {
    groupStatusByName.value = {
      ...groupStatusByName.value,
      [groupName]: state
    }
  }

  const hydrateGroup = async (groupName) => {
    if (!combinedGroups.value || !combinedGroups.value[groupName]) {
      setGroupState(groupName, 'empty')
      return
    }

    if (getCachedGroupData(groupName)) {
      setGroupState(groupName, 'loaded')
      return
    }

    setGroupState(groupName, 'loading')
    try {
      const hydratedData = await hydrateGroupDetails(groupName, combinedGroups.value[groupName])
      const groupContent = {
        endpoints: hydratedData?.endpoints || [],
        suites: hydratedData?.suites || []
      }
      groupDetailsCache.value = {
        ...groupDetailsCache.value,
        [createCacheKey(groupName, filterCacheKey.value)]: groupContent
      }
      setGroupState(groupName, groupContent.endpoints.length > 0 || groupContent.suites.length > 0 ? 'loaded' : 'empty')
    } catch (_error) {
      setGroupState(groupName, 'error')
    }
  }

  const toggleGroupCollapse = async (groupName) => {
    if (uncollapsedGroups.value.has(groupName)) {
      uncollapsedGroups.value.delete(groupName)
      persistUncollapsedGroups()
      return
    }

    uncollapsedGroups.value.add(groupName)
    persistUncollapsedGroups()
    await hydrateGroup(groupName)
  }

  const isGroupOpen = (groupName) => {
    return uncollapsedGroups.value.has(groupName)
  }

  const getGroupStatus = (groupName) => {
    return groupStatusByName.value[groupName] || DEFAULT_GROUP_STATE
  }

  const getGroupItems = (groupName) => {
    return getCachedGroupData(groupName) || combinedGroups.value?.[groupName] || { endpoints: [], suites: [] }
  }

  watch(filterCacheKey, () => {
    groupDetailsCache.value = {}
    const nextGroupStates = {}
    uncollapsedGroups.value.forEach((groupName) => {
      nextGroupStates[groupName] = DEFAULT_GROUP_STATE
    })
    groupStatusByName.value = nextGroupStates
  })

  const openedGroupCount = computed(() => uncollapsedGroups.value.size)

  return {
    uncollapsedGroups,
    groupStatusByName,
    openedGroupCount,
    initializeCollapsedGroups,
    toggleGroupCollapse,
    isGroupOpen,
    getGroupStatus,
    getGroupItems
  }
}
