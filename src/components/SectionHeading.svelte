<script lang="ts">
  /**
   * A section's opening block: the numbered eyebrow, the heading, and an optional
   * intro line.
   *
   * All four sections open the same way, so the shape lives here once. The heading
   * is an `h2` because the page has one `h1` — the name in the introduction — and
   * the section titles sit under it.
   *
   * The surrounding column and grid placement stay with the page: they differ per
   * section and are layout, not content.
   */
  let { index, label, headingId, title, intro, introClass = "section-intro" } =
    $props<{
      /** The section's position in the reading order, as two digits. */
      index: string;
      /** The section's name, as the header labels it. */
      label: string;
      /** The heading's id, which the section names itself by. */
      headingId: string;
      title: string;
      intro?: string;
      introClass?: string;
    }>();
</script>

<p class="eyebrow">{index} / {label}</p>
<h2 id={headingId} class="section-title" data-reveal>{title}</h2>
{#if intro}
  <p class={introClass} data-reveal>{intro}</p>
{/if}
