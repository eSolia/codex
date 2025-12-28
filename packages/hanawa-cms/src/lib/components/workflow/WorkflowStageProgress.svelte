<script lang="ts">
  /**
   * Workflow Stage Progress Component
   * InfoSec: Visual representation of workflow stages and progress
   */

  interface Stage {
    id: string;
    name: string;
    stageOrder: number;
    stageType: 'draft' | 'review' | 'approval' | 'published';
    description?: string;
  }

  interface Props {
    stages: Stage[];
    currentStageId: string;
    completedStageIds?: string[];
    compact?: boolean;
  }

  let { stages, currentStageId, completedStageIds = [], compact = false }: Props = $props();

  let sortedStages = $derived([...stages].sort((a, b) => a.stageOrder - b.stageOrder));

  function getStageStatus(stage: Stage): 'completed' | 'current' | 'upcoming' {
    if (completedStageIds.includes(stage.id)) return 'completed';
    if (stage.id === currentStageId) return 'current';
    return 'upcoming';
  }

  function getStageColors(status: 'completed' | 'current' | 'upcoming') {
    const colors = {
      completed: {
        circle: 'bg-green-500 border-green-500',
        line: 'bg-green-500',
        text: 'text-green-700',
        icon: 'text-white',
      },
      current: {
        circle: 'bg-white border-esolia-navy border-2',
        line: 'bg-gray-200',
        text: 'text-esolia-navy font-semibold',
        icon: 'text-esolia-navy',
      },
      upcoming: {
        circle: 'bg-white border-gray-300 border',
        line: 'bg-gray-200',
        text: 'text-gray-400',
        icon: 'text-gray-400',
      },
    };
    return colors[status];
  }

  function getStageIcon(type: Stage['stageType']) {
    const icons: Record<Stage['stageType'], string> = {
      draft:
        'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      review:
        'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      approval: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      published:
        'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
    };
    return icons[type];
  }
</script>

{#if compact}
  <!-- Compact horizontal progress bar -->
  <div class="workflow-progress-compact flex items-center gap-1">
    {#each sortedStages as stage, index (stage.id)}
      {@const status = getStageStatus(stage)}
      {@const colors = getStageColors(status)}

      {#if index > 0}
        <div class="w-6 h-0.5 {colors.line}"></div>
      {/if}

      <div
        class="relative group"
        title="{stage.name}{stage.description ? `: ${stage.description}` : ''}"
      >
        <div class="w-6 h-6 rounded-full flex items-center justify-center {colors.circle}">
          {#if status === 'completed'}
            <svg
              class="w-3.5 h-3.5 {colors.icon}"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          {:else}
            <span class="text-xs {colors.icon}">{index + 1}</span>
          {/if}
        </div>

        <!-- Tooltip -->
        <div
          class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10"
        >
          <div class="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
            {stage.name}
          </div>
        </div>
      </div>
    {/each}
  </div>
{:else}
  <!-- Full stage list with descriptions -->
  <div class="workflow-progress">
    <nav aria-label="Workflow progress">
      <ol class="overflow-hidden">
        {#each sortedStages as stage, index (stage.id)}
          {@const status = getStageStatus(stage)}
          {@const colors = getStageColors(status)}
          {@const isLast = index === sortedStages.length - 1}

          <li class="relative {!isLast ? 'pb-8' : ''}">
            {#if !isLast}
              <!-- Connector line -->
              <div
                class="absolute left-4 top-8 -ml-px h-full w-0.5 {status === 'completed'
                  ? 'bg-green-500'
                  : 'bg-gray-200'}"
                aria-hidden="true"
              ></div>
            {/if}

            <div class="relative flex items-start group">
              <!-- Circle indicator -->
              <span class="flex h-8 items-center">
                <span
                  class="relative z-10 flex h-8 w-8 items-center justify-center rounded-full {colors.circle}"
                >
                  {#if status === 'completed'}
                    <svg
                      class="w-4 h-4 {colors.icon}"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  {:else if status === 'current'}
                    <span class="h-2.5 w-2.5 rounded-full bg-esolia-navy"></span>
                  {:else}
                    <svg
                      class="w-4 h-4 {colors.icon}"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d={getStageIcon(stage.stageType)}
                      />
                    </svg>
                  {/if}
                </span>
              </span>

              <!-- Stage info -->
              <span class="ml-4 flex min-w-0 flex-col">
                <span class="text-sm {colors.text}">{stage.name}</span>
                {#if stage.description}
                  <span class="text-xs text-gray-500">{stage.description}</span>
                {/if}
              </span>
            </div>
          </li>
        {/each}
      </ol>
    </nav>
  </div>
{/if}
