<script lang="ts">
  /**
   * A section's opening block: the numbered eyebrow, the heading, and an optional
   * intro line.
   *
   * All four sections open the same way, so the shape lives here once. Each
   * section is now its own page, so the heading is that page's `h1` — the one
   * heading a document should have — and it is styled by its own class rather
   * than by its tag, so the introduction's name keeps the display treatment on
   * the opening page.
   *
   * The surrounding column and grid placement stay with the page: they differ per
   * section and are layout, not content.
   */
  let { index, label, headingId, title, intro, introClass = "section-intro" } =
    $props<{
      /** The section's position in the map, as two digits. */
      index: string;
      /** The section's name, as the map labels it. */
      label: string;
      /** The heading's id, which the section names itself by. */
      headingId: string;
      title: string;
      intro?: string;
      introClass?: string;
    }>();
</script>

<!--
  The eyebrow carries the same view-transition name as the destination star that
  leads here, so choosing a star morphs that star into this page's marker rather
  than cutting to a new document. The name is set as a raw CSS property because
  Astro's `transition:name` directive is not available inside a Svelte component.
-->
<p class="eyebrow" style={`view-transition-name: star-${label.toLowerCase()}`}>{index} / {label}</p>
<h1 id={headingId} class="section-title" data-reveal>{title}</h1>
{#if intro}
  <p class={introClass} data-reveal>{intro}</p>
{/if}
