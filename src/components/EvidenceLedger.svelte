<script lang="ts">
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
</script>
<ol class="evidence-ledger" aria-label="Technical Profile evidence ledger">
  {#each records as record, index}
    <li>
      <details name="technical-profile" open={index === 0}>
        <summary class="ledger-disclosure" aria-label={`Evidence detail: ${record.capability}`}>
          <span class="ledger-number" aria-hidden="true">0{index + 1}</span>
          <span class="ledger-capability">{record.capability}</span>
          <span class="ledger-indicator" aria-hidden="true"></span>
        </summary>
        <dl id={`evidence-detail-${index}`} class="ledger-details">
          <div class="ledger-field">
            <dt>Observed evidence</dt>
            <dd>{record.observedEvidence}</dd>
          </div>
          <div class="ledger-field ledger-qualification">
            <dt>Qualification</dt>
            <dd>{record.qualification}</dd>
          </div>
        </dl>
      </details>
      <p class="ledger-source">
        <span class="ledger-source-label">Source</span>
        {#each record.sources as source}
          <a href={source.href}>{source.name} ↗</a>
        {/each}
      </p>
    </li>
  {/each}
</ol>
