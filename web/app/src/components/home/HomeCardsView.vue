<template>
  <div>
    <div v-if="filteredSuites.length > 0" class="mb-6">
      <h2 class="text-lg font-semibold text-foreground mb-3">Suites</h2>
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <SuiteCard
          v-for="suite in paginatedSuites"
          :key="suite.key"
          :suite="suite"
          :maxResults="resultPageSize"
          @showTooltip="handleShowTooltip"
        />
      </div>
    </div>

    <div v-if="filteredEndpoints.length > 0">
      <h2 v-if="filteredSuites.length > 0" class="text-lg font-semibold text-foreground mb-3">Endpoints</h2>
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <EndpointCard
          v-for="endpoint in paginatedEndpoints"
          :key="endpoint.key"
          :endpoint="endpoint"
          :maxResults="resultPageSize"
          :showAverageResponseTime="showAverageResponseTime"
          @showTooltip="handleShowTooltip"
        />
      </div>
    </div>

    <div v-if="totalPages > 1" class="mt-8 flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="icon"
        :disabled="currentPage === 1"
        @click="$emit('goToPage', currentPage - 1)"
      >
        <ChevronLeft class="h-4 w-4" />
      </Button>

      <div class="flex gap-1">
        <Button
          v-for="page in visiblePages"
          :key="page"
          :variant="page === currentPage ? 'default' : 'outline'"
          size="sm"
          @click="$emit('goToPage', page)"
        >
          {{ page }}
        </Button>
      </div>

      <Button
        variant="outline"
        size="icon"
        :disabled="currentPage === totalPages"
        @click="$emit('goToPage', currentPage + 1)"
      >
        <ChevronRight class="h-4 w-4" />
      </Button>
    </div>
  </div>
</template>

<script setup>
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import EndpointCard from '@/components/EndpointCard.vue'
import SuiteCard from '@/components/SuiteCard.vue'

defineProps({
  filteredSuites: {
    type: Array,
    required: true
  },
  filteredEndpoints: {
    type: Array,
    required: true
  },
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
  totalPages: {
    type: Number,
    required: true
  },
  currentPage: {
    type: Number,
    required: true
  },
  visiblePages: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['goToPage', 'showTooltip'])

const handleShowTooltip = (...payload) => {
  emit('showTooltip', ...payload)
}
</script>
