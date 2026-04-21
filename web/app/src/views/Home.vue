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
              :title="showAverageResponseTime ? 'Show min-max response time' : 'Show average response time'"
              @click="toggleShowAverageResponseTime"
            >
              <Activity v-if="showAverageResponseTime" class="h-5 w-5" />
              <Timer v-else class="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" title="Refresh data" @click="refreshData">
              <RefreshCw class="h-5 w-5" />
            </Button>
          </div>
        </div>

        <AnnouncementBanner :announcements="activeAnnouncements" />

        <SearchBar
          @search="handleSearch"
          @update:showOnlyFailing="showOnlyFailing = $event"
          @update:showRecentFailures="showRecentFailures = $event"
          @update:groupByGroup="groupByGroup = $event"
          @update:sortBy="sortBy = $event"
          @initializeCollapsedGroups="initializeCollapsedGroups"
        />
      </div>

      <div v-if="loading" class="flex items-center justify-center py-20">
        <Loading size="lg" />
      </div>

      <div v-else-if="filteredEndpoints.length === 0 && filteredSuites.length === 0" class="text-center py-20">
        <AlertCircle class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 class="text-lg font-semibold mb-2">No endpoints or suites found</h3>
        <p class="text-muted-foreground">
          {{ searchInput || showOnlyFailing || showRecentFailures ? 'Try adjusting your filters' : 'No endpoints or suites are configured' }}
        </p>
      </div>

      <div v-else>
        <HomeGroupedView
          v-if="groupByGroup"
          :combinedGroups="combinedGroups"
          :resultPageSize="resultPageSize"
          :showAverageResponseTime="showAverageResponseTime"
          :isGroupOpen="isGroupOpen"
          :getGroupStatus="getGroupStatus"
          :getGroupItems="getGroupItems"
          :calculateUnhealthyCount="calculateUnhealthyCount"
          :calculateFailingSuitesCount="calculateFailingSuitesCount"
          @toggleGroup="toggleGroupCollapse"
          @showTooltip="showTooltip"
        />

        <HomeCardsView
          v-else
          :paginatedSuites="paginatedSuites"
          :paginatedEndpoints="paginatedEndpoints"
          :resultPageSize="resultPageSize"
          :showAverageResponseTime="showAverageResponseTime"
          :currentPage="currentPage"
          :hasMore="hasMoreCards"
          @showTooltip="showTooltip"
          @loadMore="loadMoreCards"
        />
      </div>

      <div v-if="archivedAnnouncements.length > 0" class="mt-12 pb-8">
        <PastAnnouncements :announcements="archivedAnnouncements" />
      </div>
    </div>

    <Settings @refreshData="fetchData" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Activity, AlertCircle, RefreshCw, Timer } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import SearchBar from '@/components/SearchBar.vue'
import Settings from '@/components/Settings.vue'
import Loading from '@/components/Loading.vue'
import AnnouncementBanner from '@/components/AnnouncementBanner.vue'
import PastAnnouncements from '@/components/PastAnnouncements.vue'
import HomeCardsView from '@/components/home/HomeCardsView.vue'
import HomeGroupedView from '@/components/home/HomeGroupedView.vue'
import { useHomeFilters } from '@/composables/useHomeFilters'
import { useHomePagination } from '@/composables/useHomePagination'
import { useHomeSearch } from '@/composables/useHomeSearch'
import { useHomeGroups } from '@/composables/useHomeGroups'

const props = defineProps({
  announcements: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['showTooltip'])

const endpointStatuses = ref([])
const suiteStatuses = ref([])
const loading = ref(false)
const currentPage = ref(1)
const itemsPerPage = ref(96)
const showOnlyFailing = ref(false)
const showRecentFailures = ref(false)
const showAverageResponseTime = ref(localStorage.getItem('gatus:show-average-response-time') !== 'false')
const groupByGroup = ref(false)
const sortBy = ref(localStorage.getItem('gatus:sort-by') || 'name')
const resultPageSize = parseInt(window.config.maximumNumberOfResults) > 0 ? parseInt(window.config.maximumNumberOfResults) : 50

const { searchInput, debouncedQuery, createRequestSignal } = useHomeSearch({ debounceMs: 300 })

const activeAnnouncements = computed(() => {
  return props.announcements ? props.announcements.filter((announcement) => !announcement.archived) : []
})

const archivedAnnouncements = computed(() => {
  return props.announcements ? props.announcements.filter((announcement) => announcement.archived) : []
})

const {
  filteredEndpoints,
  filteredSuites,
  combinedGroups,
  calculateUnhealthyCount,
  calculateFailingSuitesCount
} = useHomeFilters({
  endpointStatuses,
  suiteStatuses,
  searchQuery: debouncedQuery,
  showOnlyFailing,
  showRecentFailures,
  sortBy,
  groupByGroup
})

const {
  totalPages,
  paginatedEndpoints,
  paginatedSuites
} = useHomePagination({
  filteredEndpoints,
  filteredSuites,
  groupByGroup,
  currentPage,
  itemsPerPage
})

const hasMoreCards = computed(() => currentPage.value < totalPages.value)

const filterCacheKey = computed(() => {
  return `${debouncedQuery.value}|${sortBy.value}|${showOnlyFailing.value}|${showRecentFailures.value}`
})

const {
  initializeCollapsedGroups,
  toggleGroupCollapse,
  isGroupOpen,
  getGroupStatus,
  getGroupItems
} = useHomeGroups({
  combinedGroups,
  filterCacheKey,
  hydrateGroupDetails: async (_groupName, groupData) => ({
    endpoints: groupData.endpoints || [],
    suites: groupData.suites || []
  })
})

const fetchData = async () => {
  const isInitialLoad = endpointStatuses.value.length === 0 && suiteStatuses.value.length === 0
  if (isInitialLoad) {
    loading.value = true
  }

  const requestSignal = createRequestSignal()
  try {
    const [endpointResponse, suiteResponse] = await Promise.all([
      fetch(`/api/v1/endpoints/statuses?page=1&pageSize=${resultPageSize}`, {
        credentials: 'include',
        signal: requestSignal
      }),
      fetch(`/api/v1/suites/statuses?page=1&pageSize=${resultPageSize}`, {
        credentials: 'include',
        signal: requestSignal
      })
    ])

    if (endpointResponse.status === 200) {
      endpointStatuses.value = await endpointResponse.json()
    } else {
      console.error('[Home][fetchData] Error fetching endpoints:', await endpointResponse.text())
    }

    if (suiteResponse.status === 200) {
      suiteStatuses.value = (await suiteResponse.json()) || []
    } else {
      console.error('[Home][fetchData] Error fetching suites:', await suiteResponse.text())
      if (!suiteStatuses.value) {
        suiteStatuses.value = []
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('[Home][fetchData] Error:', error)
    }
  } finally {
    if (isInitialLoad) {
      loading.value = false
    }
  }
}

const refreshData = () => {
  endpointStatuses.value = []
  suiteStatuses.value = []
  currentPage.value = 1
  fetchData()
}

const handleSearch = (query) => {
  searchInput.value = query
}

const loadMoreCards = () => {
  if (!hasMoreCards.value) {
    return
  }
  currentPage.value += 1
}

const toggleShowAverageResponseTime = () => {
  showAverageResponseTime.value = !showAverageResponseTime.value
  localStorage.setItem('gatus:show-average-response-time', showAverageResponseTime.value ? 'true' : 'false')
}

const showTooltip = (result, event, action = 'hover') => {
  emit('showTooltip', result, event, action)
}

const dashboardHeading = computed(() => {
  return window.config && window.config.dashboardHeading && window.config.dashboardHeading !== '{{ .UI.DashboardHeading }}'
    ? window.config.dashboardHeading
    : 'Health Dashboard'
})

const dashboardSubheading = computed(() => {
  return window.config && window.config.dashboardSubheading && window.config.dashboardSubheading !== '{{ .UI.DashboardSubheading }}'
    ? window.config.dashboardSubheading
    : 'Monitor the health of your endpoints in real-time'
})

watch([debouncedQuery, showOnlyFailing, showRecentFailures, sortBy], () => {
  currentPage.value = 1
})

onMounted(() => {
  fetchData()
})
</script>