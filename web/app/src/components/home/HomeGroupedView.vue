<template>
  <div class="space-y-6">
    <div
      v-for="(items, groupName) in combinedGroups"
      :key="groupName"
      class="endpoint-group border rounded-lg overflow-hidden"
    >
      <div
        class="endpoint-group-header flex items-center justify-between p-4 bg-card border-b cursor-pointer hover:bg-accent/50 transition-colors"
        @click="$emit('toggleGroup', groupName)"
      >
        <div class="flex items-center gap-3">
          <ChevronDown v-if="isGroupOpen(groupName)" class="h-5 w-5 text-muted-foreground" />
          <ChevronUp v-else class="h-5 w-5 text-muted-foreground" />
          <h2 class="text-xl font-semibold text-foreground">{{ groupName }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <span
            v-if="calculateUnhealthyCount(items.endpoints) + calculateFailingSuitesCount(items.suites) > 0"
            class="bg-red-600 text-white px-2 py-1 rounded-full text-sm font-medium"
          >
            {{ calculateUnhealthyCount(items.endpoints) + calculateFailingSuitesCount(items.suites) }}
          </span>
          <CheckCircle v-else class="h-6 w-6 text-green-600" />
        </div>
      </div>

      <div v-if="isGroupOpen(groupName)" class="endpoint-group-content p-4">
        <div v-if="getGroupStatus(groupName) === 'loading'" class="py-4 text-sm text-muted-foreground">
          Loading group details...
        </div>

        <div v-else-if="getGroupStatus(groupName) === 'error'" class="py-4 text-sm text-red-600 dark:text-red-400">
          Failed to load group details.
        </div>

        <template v-else>
          <div v-if="getGroupItems(groupName).suites.length > 0" class="mb-4">
            <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Suites</h3>
            <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <SuiteCard
                v-for="suite in getGroupItems(groupName).suites"
                :key="suite.key"
                :suite="suite"
                :maxResults="resultPageSize"
                @showTooltip="handleShowTooltip"
              />
            </div>
          </div>

          <div v-if="getGroupItems(groupName).endpoints.length > 0">
            <h3
              v-if="getGroupItems(groupName).suites.length > 0"
              class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3"
            >
              Endpoints
            </h3>
            <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <EndpointCard
                v-for="endpoint in getGroupItems(groupName).endpoints"
                :key="endpoint.key"
                :endpoint="endpoint"
                :maxResults="resultPageSize"
                :showAverageResponseTime="showAverageResponseTime"
                @showTooltip="handleShowTooltip"
              />
            </div>
          </div>

          <div
            v-if="getGroupStatus(groupName) === 'empty'"
            class="py-4 text-sm text-muted-foreground"
          >
            No items available for this group.
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-vue-next'
import EndpointCard from '@/components/EndpointCard.vue'
import SuiteCard from '@/components/SuiteCard.vue'

defineProps({
  combinedGroups: {
    type: Object,
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
  isGroupOpen: {
    type: Function,
    required: true
  },
  getGroupStatus: {
    type: Function,
    required: true
  },
  getGroupItems: {
    type: Function,
    required: true
  },
  calculateUnhealthyCount: {
    type: Function,
    required: true
  },
  calculateFailingSuitesCount: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['toggleGroup', 'showTooltip'])

const handleShowTooltip = (...payload) => {
  emit('showTooltip', ...payload)
}
</script>
