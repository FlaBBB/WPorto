<script lang="ts">
  /**
   * A section's opening block: the numbered eyebrow, the heading, and an optional
   * intro line.
   *
   * All four body sections open the same way, so the shape lives here once. The
   * heading is a focus target (`tabindex="-1"`) because the opening's section map
   * moves focus to it after navigating, and it carries `data-reveal` so the page's
   * reveal module animates it like every other block.
   *
   * The surrounding column and grid placement stay with the page: they differ per
   * section and are layout, not content.
   */
  let {
    index,
    label,
    headingId,
    title,
    intro,
    introClass = "section-intro",
  } = $props<{
    /** The section's position in the map, as two digits. */
    index: string;
    /** The section's name, as the map labels it. */
    label: string;
    /** The heading's id, which is also the focus target the map hands over to. */
    headingId: string;
    title: string;
    intro?: string;
    introClass?: string;
  }>();
</script>

<p class="eyebrow">{index} / {label}</p>
<h2 id={headingId} tabindex="-1" data-reveal>{title}</h2>
{#if intro}
  <p class={introClass} data-reveal>{intro}</p>
{/if}
