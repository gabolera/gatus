<template>
  <div>
    <div ref="virtualListRef">
      <div class="relative" :style="{ height: `${rowVirtualizer.getTotalSize()}px` }">
        <div
          v-for="virtualRow in rowVirtualizer.getVirtualItems()"
          :key="rows[virtualRow.index]?.key || virtualRow.key"
          :ref="rowVirtualizer.measureElement"
          :data-index="virtualRow.index"
          class="absolute left-0 top-0 w-full"
          :style="{ transform: `translateY(${Math.round(Math.max(0, virtualRow.start - listOffsetTop))}px)` }"
        >
          <div v-if="rows[virtualRow.index]?.type === 'section-header'" :class="rows[virtualRow.index].className">
            <h2 class="text-lg font-semibold text-foreground mb-3">{{ rows[virtualRow.index].title }}</h2>
          </div>

          <div
            v-else-if="rows[virtualRow.index]?.type === 'suite-row'"
            :class="rows[virtualRow.index].className"
          >
            <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <SuiteCard
                v-for="suite in rows[virtualRow.index].items"
                :key="suite.key"
                :suite="suite"
                :maxResults="resultPageSize"
                @showTooltip="handleShowTooltip"
              />
            </div>
          </div>

          <div
            v-else-if="rows[virtualRow.index]?.type === 'endpoint-row'"
            :class="rows[virtualRow.index].className"
          >
            <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <EndpointCard
                v-for="endpoint in rows[virtualRow.index].items"
                :key="endpoint.key"
                :endpoint="endpoint"
                :maxResults="resultPageSize"
                :showAverageResponseTime="showAverageResponseTime"
                @showTooltip="handleShowTooltip"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div ref="infiniteSentinel" class="h-1" />

    <div v-if="hasMore" class="mt-6 text-center text-sm text-muted-foreground">
      Scroll to load more...
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useWindowVirtualizer } from '@tanstack/vue-virtual'
import EndpointCard from '@/components/EndpointCard.vue'
import SuiteCard from '@/components/SuiteCard.vue'

const props = defineProps({
  paginatedSuites: {
    type: Array,
    required: true
  },
  paginatedEndpoints: {
    type: Array,
    required: true
  },
  resultPageSize: {
    type: Number,
    required: true
  },
  showAverageResponseTime: {
    type: Boolean,
    required: true
  },
  currentPage: {
    type: Number,
    required: true
  },
  hasMore: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['loadMore', 'showTooltip'])

const virtualListRef = ref(null)
const infiniteSentinel = ref(null)
const listOffsetTop = ref(0)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const lastRequestedPage = ref(null)
const pendingAnchor = ref(null)
let sentinelObserver = null

const columnsPerRow = computed(() => {
  if (windowWidth.value >= 1024) return 3
  if (windowWidth.value >= 640) return 2
  return 1
})

const chunkItems = (items) => {
  const rows = []
  for (let index = 0; index < items.length; index += columnsPerRow.value) {
    rows.push(items.slice(index, index + columnsPerRow.value))
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

const rows = computed(() => {
  const result = []

  if (props.paginatedSuites.length > 0) {
    result.push({
      key: 'suites-header',
      type: 'section-header',
      title: 'Suites',
      className: 'mb-3'
    })
    result.push(...createCardRows(props.paginatedSuites, 'suite-row', 'suite', 'mb-3'))
  }

  if (props.paginatedEndpoints.length > 0) {
    result.push({
      key: 'endpoints-header',
      type: 'section-header',
      title: 'Endpoints',
      className: props.paginatedSuites.length > 0 ? 'mt-3 mb-3' : 'mb-3'
    })
    result.push(...createCardRows(props.paginatedEndpoints, 'endpoint-row', 'endpoint', 'mb-3'))
  }

  return result
})

const estimateRowSize = (row) => {
  if (!row) return 220
  if (row.type === 'section-header') return 48
  return 250
}

const rowVirtualizer = useWindowVirtualizer(computed(() => ({
  count: rows.value.length,
  getItemKey: (index) => rows.value[index]?.key || index,
  estimateSize: (index) => estimateRowSize(rows.value[index]),
  overscan: 4,
  scrollMargin: listOffsetTop.value
})))

const updateViewportMetrics = () => {
  if (typeof window === 'undefined') return
  windowWidth.value = window.innerWidth
  if (virtualListRef.value) {
    listOffsetTop.value = Math.round(virtualListRef.value.getBoundingClientRect().top + window.scrollY)
  }
}

const requestMoreIfNeeded = () => {
  if (!props.hasMore) {
    return
  }
  if (lastRequestedPage.value === props.currentPage) {
    return
  }
  lastRequestedPage.value = props.currentPage
  emit('loadMore')
}

const setupInfiniteObserver = () => {
  if (!infiniteSentinel.value || typeof window === 'undefined') {
    return
  }
  sentinelObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        requestMoreIfNeeded()
      }
    },
    { root: null, rootMargin: '400px 0px', threshold: 0.01 }
  )
  sentinelObserver.observe(infiniteSentinel.value)
}

const captureAnchor = () => {
  if (typeof window === 'undefined') {
    pendingAnchor.value = null
    return
  }
  const virtualItems = rowVirtualizer.value.getVirtualItems()
  if (!virtualItems.length) {
    pendingAnchor.value = null
    return
  }
  const firstVisible = virtualItems[0]
  const rowKey = rows.value[firstVisible.index]?.key
  if (!rowKey) {
    pendingAnchor.value = null
    return
  }
  const relativeScroll = window.scrollY - listOffsetTop.value
  pendingAnchor.value = {
    rowKey,
    delta: relativeScroll - firstVisible.start
  }
}

const restoreAnchor = async () => {
  if (typeof window === 'undefined' || !pendingAnchor.value) {
    return
  }

  const anchorIndex = rows.value.findIndex((row) => row.key === pendingAnchor.value.rowKey)
  if (anchorIndex < 0) {
    pendingAnchor.value = null
    return
  }

  rowVirtualizer.value.scrollToIndex(anchorIndex, { align: 'start' })
  await nextTick()
  const anchoredItem = rowVirtualizer.value.getVirtualItems().find((item) => item.index === anchorIndex)
  if (anchoredItem) {
    window.scrollTo({
      top: Math.max(0, listOffsetTop.value + anchoredItem.start + pendingAnchor.value.delta)
    })
  }
  pendingAnchor.value = null
}

const handleShowTooltip = (...payload) => {
  emit('showTooltip', ...payload)
}

watch(() => [props.currentPage, props.hasMore], ([currentPage, hasMore]) => {
  if (!hasMore || currentPage === 1) {
    lastRequestedPage.value = null
  }
})

watch([rows, columnsPerRow], async () => {
  captureAnchor()
  await nextTick()
  updateViewportMetrics()
  rowVirtualizer.value.measure()
  await nextTick()
  await restoreAnchor()
}, { flush: 'post' })

onMounted(async () => {
  await nextTick()
  updateViewportMetrics()
  setupInfiniteObserver()
  window.addEventListener('resize', updateViewportMetrics)
})

onUnmounted(() => {
  if (sentinelObserver) {
    sentinelObserver.disconnect()
    sentinelObserver = null
  }
  window.removeEventListener('resize', updateViewportMetrics)
})
</script>
