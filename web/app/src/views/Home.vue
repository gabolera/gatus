<template>
  <div class="dashboard-container bg-background">
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <div class="mb-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-4xl font-bold tracking-tight">{{ dashboardHeading }}</h1>
            <p class="text-muted-foreground mt-2">{{ dashboardSubheading }}</p>
          </div>
          <div class="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              @click="toggleShowAverageResponseTime" 
              :title="showAverageResponseTime ? 'Show min-max response time' : 'Show average response time'"
            >
              <Activity v-if="showAverageResponseTime" class="h-5 w-5" />
              <Timer v-else class="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" @click="refreshData" title="Refresh data">
              <RefreshCw class="h-5 w-5" />
            </Button>
          </div>
        </div>
        <!-- Announcement Banner (Active Announcements) -->
        <AnnouncementBanner :announcements="activeAnnouncements" />
        <!-- Search bar -->
        <SearchBar
          @search="handleSearch"
          @update:showOnlyFailing="showOnlyFailing = $event"
          @update:showRecentFailures="showRecentFailures = $event"
          @update:groupByGroup="groupByGroup = $event"
          @update:sortBy="sortBy = $event"
          @initializeCollapsedGroups="initializeCollapsedGroups"
        />
      </div>

      <!-- Stable min-height + skeleton reduces CLS when data replaces loading state -->
      <div class="min-h-[min(70vh,720px)]">
        <div v-if="loading" class="relative pt-4" aria-busy="true" aria-label="Loading dashboard">
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="n in 6"
              :key="n"
              class="h-52 rounded-lg border border-border bg-muted/50 animate-pulse dark:bg-muted/20"
            />
          </div>
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loading size="lg" />
          </div>
        </div>

        <div
          v-else-if="filteredEndpoints.length === 0 && filteredSuites.length === 0"
          class="flex flex-col items-center justify-center py-20 text-center"
        >
          <AlertCircle class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 class="text-lg font-semibold mb-2">No endpoints or suites found</h3>
          <p class="text-muted-foreground">
            {{ searchQuery || showOnlyFailing || showRecentFailures 
              ? 'Try adjusting your filters' 
              : 'No endpoints or suites are configured' }}
          </p>
        </div>

        <div v-else>
        <!-- Grouped view: keep stable non-virtual layout -->
        <div v-if="groupByGroup" class="space-y-6">
          <div v-for="(items, group) in combinedGroups" :key="group" class="endpoint-group border rounded-lg overflow-hidden">
            <div
              @click="toggleGroupCollapse(group)"
              class="endpoint-group-header flex items-center justify-between p-4 bg-card border-b cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <div class="flex items-center gap-3">
                <ChevronDown v-if="uncollapsedGroups.has(group)" class="h-5 w-5 text-muted-foreground" />
                <ChevronUp v-else class="h-5 w-5 text-muted-foreground" />
                <h2 class="text-xl font-semibold text-foreground">{{ group }}</h2>
              </div>
              <div class="flex items-center gap-2">
                <span v-if="calculateUnhealthyCount(items.endpoints) + calculateFailingSuitesCount(items.suites) > 0" class="bg-red-600 text-white px-2 py-1 rounded-full text-sm font-medium">
                  {{ calculateUnhealthyCount(items.endpoints) + calculateFailingSuitesCount(items.suites) }}
                  {{ totalRecordsFromGroup(group) > 0 ? ' / ' + totalRecordsFromGroup(group) : '' }}
                </span>
                <CheckCircle v-else class="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div v-if="uncollapsedGroups.has(group)" class="endpoint-group-content bg-card p-4">
              <div v-if="items.suites.length > 0" class="mb-4">
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Suites</h3>
                <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <SuiteCard
                    v-for="suite in items.suites"
                    :key="suite.key"
                    :suite="suite"
                    :maxResults="resultPageSize"
                    @showTooltip="showTooltip"
                  />
                </div>
              </div>
              <div v-if="items.endpoints.length > 0">
                <h3 v-if="items.suites.length > 0" class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Endpoints</h3>
                <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <EndpointCard
                    v-for="endpoint in items.endpoints"
                    :key="endpoint.key"
                    :endpoint="endpoint"
                    :maxResults="resultPageSize"
                    :showAverageResponseTime="showAverageResponseTime"
                    @showTooltip="showTooltip"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Regular view: virtualized -->
        <div v-else ref="virtualListRef">
          <div class="relative" :style="{ height: `${rowVirtualizer.getTotalSize()}px` }">
            <div
              v-for="virtualRow in rowVirtualizer.getVirtualItems()"
              :key="virtualRows[virtualRow.index]?.key || virtualRow.key"
              :data-index="virtualRow.index"
              class="absolute left-0 top-0 w-full"
              :style="{ transform: `translateY(${Math.max(0, virtualRow.start - listOffsetTop)}px)` }"
            >
              <template v-if="virtualRows[virtualRow.index]?.type === 'section-header'">
                <div :class="virtualRows[virtualRow.index].className">
                  <h2 class="text-lg font-semibold text-foreground">{{ virtualRows[virtualRow.index].title }}</h2>
                </div>
              </template>
              <template v-else-if="virtualRows[virtualRow.index]?.type === 'suite-row'">
                <div :class="virtualRows[virtualRow.index].className">
                  <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <SuiteCard
                      v-for="suite in virtualRows[virtualRow.index].items"
                      :key="suite.key"
                      :suite="suite"
                      :maxResults="resultPageSize"
                      @showTooltip="showTooltip"
                    />
                  </div>
                </div>
              </template>
              <template v-else-if="virtualRows[virtualRow.index]?.type === 'endpoint-row'">
                <div :class="virtualRows[virtualRow.index].className">
                  <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <EndpointCard
                      v-for="endpoint in virtualRows[virtualRow.index].items"
                      :key="endpoint.key"
                      :endpoint="endpoint"
                      :maxResults="resultPageSize"
                      :showAverageResponseTime="showAverageResponseTime"
                      @showTooltip="showTooltip"
                    />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
      </div>

      <!-- Past Announcements Section -->
      <div v-if="archivedAnnouncements.length > 0" class="mt-12 pb-8">
        <PastAnnouncements :announcements="archivedAnnouncements" />
      </div>
    </div>

    <Settings @refreshData="fetchData" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useWindowVirtualizer } from '@tanstack/vue-virtual'
import { Activity, Timer, RefreshCw, AlertCircle, ChevronDown, ChevronUp, CheckCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import EndpointCard from '@/components/EndpointCard.vue'
import SuiteCard from '@/components/SuiteCard.vue'
import SearchBar from '@/components/SearchBar.vue'
import Settings from '@/components/Settings.vue'
import Loading from '@/components/Loading.vue'
import AnnouncementBanner from '@/components/AnnouncementBanner.vue'
import PastAnnouncements from '@/components/PastAnnouncements.vue'

const props = defineProps({
  announcements: {
    type: Array,
    default: () => []
  }
})

// Computed properties for active and archived announcements
const activeAnnouncements = computed(() => {
  return props.announcements ? props.announcements.filter(a => !a.archived) : []
})

const archivedAnnouncements = computed(() => {
  return props.announcements ? props.announcements.filter(a => a.archived) : []
})

const emit = defineEmits(['showTooltip'])

const endpointStatuses = ref([])
const suiteStatuses = ref([])
const loading = ref(false)
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const showOnlyFailing = ref(false)
const showRecentFailures = ref(false)
const showAverageResponseTime = ref(localStorage.getItem('gatus:show-average-response-time') !== 'false')
const groupByGroup = ref(false)
const sortBy = ref(localStorage.getItem('gatus:sort-by') || 'name')
const uncollapsedGroups = ref(new Set())
const resultPageSize = 50
const virtualListRef = ref(null)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const listOffsetTop = ref(0)
const SEARCH_DEBOUNCE_MS = 300
const RESIZE_DEBOUNCE_MS = 120
let searchDebounceTimeout = null
let resizeDebounceTimeout = null

const filteredEndpoints = computed(() => {
  let filtered = [...endpointStatuses.value]
  
  if (debouncedSearchQuery.value) {
    const query = debouncedSearchQuery.value.toLowerCase()
    filtered = filtered.filter(endpoint => 
      endpoint.name.toLowerCase().includes(query) ||
      (endpoint.group && endpoint.group.toLowerCase().includes(query))
    )
  }
  
  if (showOnlyFailing.value) {
    filtered = filtered.filter(endpoint => {
      if (!endpoint.results || endpoint.results.length === 0) return false
      const latestResult = endpoint.results[endpoint.results.length - 1]
      return !latestResult.success
    })
  }
  
  if (showRecentFailures.value) {
    filtered = filtered.filter(endpoint => {
      if (!endpoint.results || endpoint.results.length === 0) return false
      return endpoint.results.some(result => !result.success)
    })
  }
  
  // Sort by health if selected
  if (sortBy.value === 'health') {
    filtered.sort((a, b) => {
      const aHealthy = a.results && a.results.length > 0 && a.results[a.results.length - 1].success
      const bHealthy = b.results && b.results.length > 0 && b.results[b.results.length - 1].success
      
      // Unhealthy first
      if (!aHealthy && bHealthy) return -1
      if (aHealthy && !bHealthy) return 1
      
      // Then sort by name
      return a.name.localeCompare(b.name)
    })
  }
  
  return filtered
})

const filteredSuites = computed(() => {
  let filtered = [...(suiteStatuses.value || [])]
  
  if (debouncedSearchQuery.value) {
    const query = debouncedSearchQuery.value.toLowerCase()
    filtered = filtered.filter(suite => 
      suite.name.toLowerCase().includes(query) ||
      (suite.group && suite.group.toLowerCase().includes(query))
    )
  }
  
  if (showOnlyFailing.value) {
    filtered = filtered.filter(suite => {
      if (!suite.results || suite.results.length === 0) return false
      return !suite.results[suite.results.length - 1].success
    })
  }
  
  if (showRecentFailures.value) {
    filtered = filtered.filter(suite => {
      if (!suite.results || suite.results.length === 0) return false
      return suite.results.slice(-10).some(result => !result.success)
    })
  }
  
  // Sort by health if selected
  if (sortBy.value === 'health') {
    filtered.sort((a, b) => {
      const aHealthy = a.results && a.results.length > 0 && a.results[a.results.length - 1].success
      const bHealthy = b.results && b.results.length > 0 && b.results[b.results.length - 1].success
      
      // Unhealthy first
      if (!aHealthy && bHealthy) return -1
      if (aHealthy && !bHealthy) return 1
      
      // Then sort by name
      return a.name.localeCompare(b.name)
    })
  }
  
  return filtered
})

const columnsPerRow = computed(() => {
  if (windowWidth.value >= 1024) return 3
  if (windowWidth.value >= 640) return 2
  return 1
})

const chunkItems = (items) => {
  const rows = []
  for (let i = 0; i < items.length; i += columnsPerRow.value) {
    rows.push(items.slice(i, i + columnsPerRow.value))
  }
  return rows
}

const createCardRows = (items, type, prefix, className = '') => {
  return chunkItems(items).map((chunk, index) => ({
    key: `${prefix}-${index}`,
    type,
    items: chunk,
    className
  }))
}

const flatRows = computed(() => {
  const rows = []

  if (filteredSuites.value.length > 0) {
    rows.push({
      key: 'suites-header',
      type: 'section-header',
      title: 'Suites',
      className: 'mb-3'
    })
    rows.push(...createCardRows(filteredSuites.value, 'suite-row', 'suite', 'mb-3'))
  }

  if (filteredEndpoints.value.length > 0) {
    rows.push({
      key: 'endpoints-header',
      type: 'section-header',
      title: 'Endpoints',
      className: filteredSuites.value.length > 0 ? 'mt-3 mb-3' : 'mb-3'
    })
    rows.push(...createCardRows(filteredEndpoints.value, 'endpoint-row', 'endpoint', 'mb-3'))
  }

  return rows
})

const combinedGroups = computed(() => {
  if (!groupByGroup.value) {
    return null
  }
  
  const combined = {}
  
  // Add endpoints
  filteredEndpoints.value.forEach(endpoint => {
    const group = endpoint.group || 'No Group'
    if (!combined[group]) {
      combined[group] = { endpoints: [], suites: [] }
    }
    combined[group].endpoints.push(endpoint)
  })
  
  // Add suites
  filteredSuites.value.forEach(suite => {
    const group = suite.group || 'No Group'
    if (!combined[group]) {
      combined[group] = { endpoints: [], suites: [] }
    }
    combined[group].suites.push(suite)
  })
  
  // Sort groups alphabetically, with 'No Group' at the end
  const sortedGroups = Object.keys(combined).sort((a, b) => {
    if (a === 'No Group') return 1
    if (b === 'No Group') return -1
    return a.localeCompare(b)
  })
  
  const result = {}
  sortedGroups.forEach(group => {
    result[group] = combined[group]
  })
  
  return result
})

const estimateRowSize = (row) => {
  if (!row) return 160
  if (row.type === 'section-header') return 44
  // Card row ~ grid row height (cards ~13rem) + mb-3; tuned for virtualizer without measureElement
  return 212
}

const rowVirtualizer = useWindowVirtualizer(computed(() => ({
  count: flatRows.value.length,
  getItemKey: (index) => flatRows.value[index]?.key || index,
  estimateSize: (index) => estimateRowSize(flatRows.value[index]),
  overscan: 3,
  scrollMargin: listOffsetTop.value
})))

const fetchData = async () => {
  // Don't show loading state on refresh to prevent UI flicker
  const isInitialLoad = endpointStatuses.value.length === 0 && suiteStatuses.value.length === 0
  if (isInitialLoad) {
    loading.value = true
  }
  try {
    const [endpointResponse, suiteResponse] = await Promise.all([
      fetch(`/api/v1/endpoints/statuses?page=1&pageSize=${resultPageSize}`, {
        credentials: 'include'
      }),
      fetch(`/api/v1/suites/statuses?page=1&pageSize=${resultPageSize}`, {
        credentials: 'include'
      })
    ])

    if (endpointResponse.status === 200) {
      endpointStatuses.value = await endpointResponse.json()
    } else {
      console.error('[Home][fetchData] Error fetching endpoints:', await endpointResponse.text())
    }

    if (suiteResponse.status === 200) {
      const suiteData = await suiteResponse.json()
      suiteStatuses.value = suiteData || []
    } else {
      console.error('[Home][fetchData] Error fetching suites:', await suiteResponse.text())
      if (!suiteStatuses.value) {
        suiteStatuses.value = []
      }
    }
  } catch (error) {
    console.error('[Home][fetchData] Error:', error)
  } finally {
    if (isInitialLoad) {
      loading.value = false
    }
  }
}

const refreshData = () => {
  endpointStatuses.value = [];
  suiteStatuses.value = [];
  fetchData()
}

const handleSearch = (query) => {
  searchQuery.value = query
  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout)
  }
  searchDebounceTimeout = setTimeout(() => {
    debouncedSearchQuery.value = query
  }, SEARCH_DEBOUNCE_MS)
}

const toggleShowAverageResponseTime = () => {
  showAverageResponseTime.value = !showAverageResponseTime.value
  localStorage.setItem('gatus:show-average-response-time', showAverageResponseTime.value ? 'true' : 'false')
}

const showTooltip = (result, event, action = 'hover') => {
  emit('showTooltip', result, event, action)
}

const totalRecordsFromGroup = (group) => {
  return endpointStatuses.value.filter(g => g?.group === group).length
}

const calculateUnhealthyCount = (endpoints) => {
  return endpoints.filter(endpoint => {
    if (!endpoint.results || endpoint.results.length === 0) return false
    const latestResult = endpoint.results[endpoint.results.length - 1]
    return !latestResult.success
  }).length
}

const calculateFailingSuitesCount = (suites) => {
  return suites.filter(suite => {
    if (!suite.results || suite.results.length === 0) return false
    return !suite.results[suite.results.length - 1].success
  }).length
}

const toggleGroupCollapse = (groupName) => {
  if (uncollapsedGroups.value.has(groupName)) {
    uncollapsedGroups.value.delete(groupName)
  } else {
    uncollapsedGroups.value.add(groupName)
  }
  // Save to localStorage
  const uncollapsed = Array.from(uncollapsedGroups.value)
  localStorage.setItem('gatus:uncollapsed-groups', JSON.stringify(uncollapsed))
  localStorage.removeItem('gatus:collapsed-groups') // Remove old key if it exists
  nextTick(() => rowVirtualizer.value.measure())
}

const initializeCollapsedGroups = () => {
  // Get saved uncollapsed groups from localStorage
  try {
    const saved = localStorage.getItem('gatus:uncollapsed-groups')
    if (saved) {
      uncollapsedGroups.value = new Set(JSON.parse(saved))
    }
    // If no saved state, uncollapsedGroups stays empty (all collapsed by default)
  } catch (e) {
    console.warn('Failed to parse saved uncollapsed groups:', e)
    localStorage.removeItem('gatus:uncollapsed-groups')
    // On error, uncollapsedGroups stays empty (all collapsed by default)
  }
}

const virtualRows = computed(() => flatRows.value)

const updateViewportMetrics = () => {
  if (typeof window === 'undefined') return
  windowWidth.value = window.innerWidth
  if (virtualListRef.value) {
    listOffsetTop.value = virtualListRef.value.getBoundingClientRect().top + window.scrollY
  }
}

const scheduleViewportMetricsUpdate = () => {
  if (typeof window === 'undefined') return
  if (resizeDebounceTimeout) {
    clearTimeout(resizeDebounceTimeout)
  }
  resizeDebounceTimeout = setTimeout(() => {
    resizeDebounceTimeout = null
    updateViewportMetrics()
  }, RESIZE_DEBOUNCE_MS)
}

const scrollToVirtualListTop = () => {
  if (typeof window === 'undefined') return
  const targetTop = Math.max(listOffsetTop.value - 16, 0)
  window.scrollTo({ top: targetTop, behavior: 'smooth' })
}

const dashboardHeading = computed(() => {
  return window.config && window.config.dashboardHeading && window.config.dashboardHeading !== '{{ .UI.DashboardHeading }}' ? window.config.dashboardHeading : "Health Dashboard"
})

const dashboardSubheading = computed(() => {
  return window.config && window.config.dashboardSubheading && window.config.dashboardSubheading !== '{{ .UI.DashboardSubheading }}' ? window.config.dashboardSubheading : "Monitor the health of your endpoints in real-time"
})

onMounted(() => {
  fetchData()
  debouncedSearchQuery.value = searchQuery.value
  updateViewportMetrics()
  window.addEventListener('resize', scheduleViewportMetricsUpdate)
})

onUnmounted(() => {
  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout)
    searchDebounceTimeout = null
  }
  if (resizeDebounceTimeout) {
    clearTimeout(resizeDebounceTimeout)
    resizeDebounceTimeout = null
  }
  window.removeEventListener('resize', scheduleViewportMetricsUpdate)
})

watch(columnsPerRow, async () => {
  await nextTick()
  updateViewportMetrics()
  rowVirtualizer.value.measure()
})

watch(flatRows, async () => {
  await nextTick()
  updateViewportMetrics()
  rowVirtualizer.value.measure()
}, { flush: 'post' })

watch([debouncedSearchQuery, showOnlyFailing, showRecentFailures, groupByGroup, sortBy], () => {
  scrollToVirtualListTop()
})
</script>