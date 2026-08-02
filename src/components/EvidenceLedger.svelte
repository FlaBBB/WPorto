<script lang="ts">
  import { onMount } from "svelte";

  type Source = {
    name: string;
    href: string;
  };

  type ProfileRecord = {
    capability: string;
    observedEvidence: string;
    qualification: string;
    sources: Source[];
  };

  let { records }: { records: ProfileRecord[] } = $props();

  let hydrated = $state(false);
  let expandedIndex = $state(0);

  onMount(() => {
    hydrated = true;
  });

  function isExpanded(index: number) {
    return !hydrated || expandedIndex === index;
  }

  function toggleDetail(index: number) {
    expandedIndex = expandedIndex === index ? -1 : index;
  }
</script>
<ol aria-label="Technical Profile evidence ledger">
  {#each records as record, index}
    {@const detailId = `evidence-detail-${index}`}
    {@const toggleId = `evidence-toggle-${index}`}
    <li>
      <dl>
        <div class="ledger-field ledger-capability">
          <dt>Capability</dt>
          <dd>{record.capability}</dd>
          <button
            id={toggleId}
            class="ledger-disclosure"
            type="button"
            aria-controls={detailId}
            aria-expanded={isExpanded(index)}
            aria-label={`Evidence detail: ${record.capability}`}
            onclick={() => toggleDetail(index)}
          >
            {isExpanded(index) ? "Hide" : "Show"} evidence detail: {record.capability}
          </button>
        </div>
        <div
          id={detailId}
          class="ledger-details"
          role="region"
          aria-labelledby={toggleId}
          hidden={hydrated && !isExpanded(index)}
        >
          <div class="ledger-field">
            <dt>Observed evidence</dt>
            <dd>{record.observedEvidence}</dd>
          </div>
          <div class="ledger-field">
            <dt>Qualification</dt>
            <dd>{record.qualification}</dd>
          </div>
        </div>
        <div class="ledger-field ledger-source">
          <dt>Source</dt>
          <dd>
            {#each record.sources as source, sourceIndex}
              {#if sourceIndex > 0} · {/if}<a href={source.href}>{source.name} ↗</a>
            {/each}
          </dd>
        </div>
      </dl>
    </li>
  {/each}
</ol>
