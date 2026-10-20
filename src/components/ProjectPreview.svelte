<script lang="ts">
  import type { Project } from "../lib/portfolio";

  let { project }: { project: Project } = $props();
  const preview = $derived(project.preview);
</script>

<!--
  These are editorial source studies, not invented product screens. Each visual
  has a reference beside the project's Source link. No controls live inside the
  artwork, so a preview change never hides a visitor's focused link.
-->
<figure
  class="project-preview"
  data-kind={preview.kind}
  aria-label={`${project.name}: ${preview.label}`}
>
  <!--
    The plate is atmosphere, not evidence: it sits behind the study, duotoned
    into the page's own inks, and the study in front stays what a visitor reads.
    It is decorative, so it is hidden from assistive technology.
  -->
  <div class="preview-plate" aria-hidden="true">
    <img src={project.image} alt="" width="1600" height="1067" loading="lazy" decoding="async" />
  </div>
  <div class="preview-topline">
    <span>Source study / {project.index}</span>
    <span aria-hidden="true">↗</span>
  </div>

  <div class="project-art">
    {#if preview.kind === "boundaries"}
      <div class="boundary-root" data-art-node>
        <span class="preview-star" aria-hidden="true">✳</span>
        <p>packages<span>/</span></p>
      </div>
      <!--
        The three branches end at 1/6, 1/2 and 5/6 of the viewBox, which is where
        the three equal columns put their dots. `preserveAspectRatio="none"` is
        what keeps them there: the default uniform fitting scales the drawing to
        the box's height and then centres it, which compresses it horizontally and
        leaves the outer branches ending in empty space. The strokes stay true
        because they are drawn with `vector-effect: non-scaling-stroke`.
      -->
      <svg
        class="boundary-connectors"
        viewBox="0 0 480 84"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <path data-art-path d="M240 0V32H80V84" />
        <path data-art-path d="M240 0V84" />
        <path data-art-path d="M240 0V32H400V84" />
      </svg>
      <ul class="boundary-packages">
        {#each preview.packages as item}
          <li data-art-node>
            <span class="boundary-point" aria-hidden="true"></span>
            <strong>{item.name}</strong>
            <span>{item.responsibility}</span>
          </li>
        {/each}
      </ul>
    {:else if preview.kind === "compose"}
      <div class="compose-port" data-art-node>
        <span>Local port</span>
        <strong><span aria-hidden="true">:</span>{preview.port}</strong>
      </div>
      <div class="compose-services">
        {#each preview.services as service, index}
          <div class="compose-service" data-art-node>
            <span class="compose-role">{index === 0 ? "Application" : "Database"}</span>
            <strong>{service}</strong>
            {#if index === 1}<span class="compose-image">{preview.database}</span>{/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="lifecycle-caption" data-art-node>
        <span class="preview-star" aria-hidden="true">✳</span>
        <p>Request <span aria-hidden="true">→</span> complete</p>
      </div>
      <ol class="lifecycle-steps">
        {#each preview.steps as step, index}
          <li data-art-node data-approval={step.includes("approv") ? "true" : undefined}>
            <span class="lifecycle-number">{String(index + 1).padStart(2, "0")}</span>
            <span>{step}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>

  <figcaption>
    <strong>{project.name}</strong>
    <span>{preview.source} / source-derived visual</span>
  </figcaption>
</figure>

<style>
  .project-preview {
    --plate-opacity: 0.62;
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 19rem;
    margin: 0;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--rule));
    background: var(--surface);
    color: var(--ink);
    container-type: inline-size;
  }
  /*
    Painted at z-index -1, which is above the figure's own background and below
    its content, the same layering the section starfields use.
  */
  .preview-plate {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
  }
  .preview-plate img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: var(--plate-opacity);
    filter: grayscale(1) contrast(1.05) brightness(0.9);
  }
  /* Duotone: the grayscale plate takes the page's plum and violet. */
  .preview-plate::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      155deg,
      color-mix(in srgb, var(--accent) 34%, transparent),
      color-mix(in srgb, var(--background) 86%, transparent) 58%
    );
    mix-blend-mode: color;
  }
  /* A scrim toward the edges keeps the study's small type legible over it. */
  .preview-plate::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--background) 40%, transparent),
      transparent 38%,
      color-mix(in srgb, var(--background) 58%, transparent)
    );
  }
  .preview-topline,
  .project-art,
  figcaption {
    position: relative;
    z-index: 1;
  }
  .preview-topline,
  figcaption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.5rem;
    font: 400 0.625rem/1.5 var(--font-mono);
    color: var(--muted-ink);
  }
  .preview-topline {
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .preview-topline > span:last-child {
    color: var(--accent);
    font-size: 1rem;
  }
  figcaption {
    flex-wrap: wrap;
    border-top: 1px solid var(--rule);
    gap: 0.2rem 1rem;
  }
  figcaption strong {
    color: var(--ink);
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .project-art {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    min-height: 0;
    padding: 1rem 1.5rem 2rem;
  }
  .preview-star {
    color: var(--accent);
    font: 400 3.5rem/1 var(--font-mono);
  }
  .boundary-root {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
  }
  .boundary-root p {
    font: 500 clamp(1.75rem, 5cqi, 2.75rem)/1.2 var(--font-mono);
    letter-spacing: -0.05em;
  }
  .boundary-root p > span {
    color: var(--accent);
  }
  .boundary-connectors {
    display: block;
    width: 100%;
    height: 4rem;
    overflow: visible;
  }
  .boundary-connectors path {
    stroke: var(--accent);
    stroke-opacity: 0.55;
    vector-effect: non-scaling-stroke;
  }
  .boundary-packages {
    display: grid;
    /*
       No column gap: the connector tree ends at 1/6, 1/2 and 5/6 of its own width,
       which is where three *equal* columns put their dots. A gap between the
       columns moves the outer dots inward by half the gap and leaves the branches
       ending in empty space, so the breathing room between columns is padding
       inside each column instead — symmetric, and invisible to the dot centres.
    */
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    padding: 0;
    list-style: none;
  }
  .boundary-packages li {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 0.5rem;
    padding-inline: 0.5rem;
    text-align: center;
  }
  .boundary-point {
    width: 0.4rem;
    height: 0.4rem;
    margin-top: -0.2rem;
    border-radius: 50%;
    background: var(--accent);
  }
  .boundary-packages strong {
    font: 500 clamp(0.7rem, 2.6cqi, 0.875rem)/1.4 var(--font-mono);
    /* A package name is a single long word: on a phone-width study "dictionary" is
       wider than a third of the figure and would paint over the next column. */
    overflow-wrap: anywhere;
  }
  .boundary-packages li > span:last-child {
    max-width: 16ch;
    color: var(--muted-ink);
    font-size: 0.75rem;
    line-height: 1.4;
    /*
       A single long word — "normalization" is the one that does it — is wider than
       a third of a phone-width study, and would otherwise paint across the
       neighbouring column's ink. Breaking it keeps every column inside its own
       track at any container width.
    */
    overflow-wrap: anywhere;
  }
  [data-kind="compose"] {
    background: #241d32;
  }
  [data-kind="compose"] .project-art {
    display: grid;
    grid-template-columns: 0.8fr 1.2fr;
    gap: 1rem;
    align-items: center;
  }
  .compose-port {
    display: grid;
    gap: 0.75rem;
  }
  .compose-port > span,
  .compose-role {
    color: var(--muted-ink);
    font: 400 0.625rem/1.5 var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .compose-port strong {
    color: var(--accent-ink);
    font: 500 clamp(2.25rem, 8cqi, 3.5rem)/1 var(--font-mono);
    letter-spacing: -0.08em;
  }
  .compose-port strong > span {
    color: var(--accent);
  }
  .compose-services {
    display: grid;
    gap: 0.75rem;
    perspective: 900px;
  }
  .compose-service {
    display: grid;
    gap: 0.75rem;
    padding: 1.25rem;
    border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--rule));
    background: var(--background);
  }
  .compose-service strong {
    overflow-wrap: anywhere;
    font: 500 0.75rem/1.4 var(--font-mono);
  }
  .compose-image {
    color: var(--muted-ink);
    font: 400 0.625rem/1.4 var(--font-mono);
  }
  .lifecycle-caption {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.025em;
    font-size: clamp(1.25rem, 4cqi, 1.75rem);
  }
  .lifecycle-caption .preview-star {
    font-size: 2rem;
  }
  .lifecycle-caption p > span {
    color: var(--accent);
  }
  .lifecycle-steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem 1rem;
    padding: 0;
    list-style: none;
  }
  .lifecycle-steps li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding-block: 0.5rem;
    border-top: 1px solid var(--rule);
    font: 400 0.6875rem/1.4 var(--font-mono);
    overflow-wrap: anywhere;
  }
  .lifecycle-number {
    color: var(--muted-ink);
    font-size: 0.5625rem;
    /* The step's own number must never wrap: it is a two-digit ordinal, and a
       wrapped one reads as a different step. */
    flex: none;
  }
  .lifecycle-steps [data-approval="true"] {
    color: var(--accent-ink);
    border-color: color-mix(in srgb, var(--accent) 50%, var(--rule));
  }
  /*
    A short stage cannot hold the studies at their reading size, and a study whose
    steps are cut off explains nothing — least of all the boundary study, whose
    branches have to meet their dots. The stage's own height decides which
    treatment the study gets, because the same viewport width is roomy or cramped
    depending only on how tall the viewport is. The numbers below are the ones
    that make every study fit the shortest stage this layout is allowed to run at;
    `probe-study-fit.json` records the measurements behind them.
  */
  @container study (max-height: 400px) {
    .preview-topline,
    figcaption {
      padding-block: 0.6rem;
    }
    .project-art {
      padding-block: 0.5rem 1rem;
    }
    .preview-star {
      font-size: 2.25rem;
    }
    .boundary-root {
      gap: 0.35rem;
    }
    .boundary-root p {
      font-size: clamp(1.5rem, 4.5cqi, 2rem);
    }
    .boundary-connectors {
      height: 2rem;
    }
    .boundary-packages li {
      gap: 0.3rem;
    }
    .boundary-packages li > span:last-child {
      font-size: 0.6875rem;
      line-height: 1.3;
    }
    .compose-port {
      gap: 0.4rem;
    }
    .compose-port strong {
      font-size: clamp(1.5rem, 5.5cqi, 2.25rem);
    }
    .compose-services {
      gap: 0.4rem;
    }
    .compose-service {
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
    }
    .lifecycle-caption {
      margin-bottom: 0.75rem;
      font-size: clamp(1.0625rem, 3cqi, 1.375rem);
    }
    .lifecycle-caption .preview-star {
      font-size: 1.5rem;
    }
    .lifecycle-steps {
      gap: 0 1rem;
    }
    .lifecycle-steps li {
      padding-block: 0.3rem;
      font-size: 0.625rem;
      line-height: 1.35;
    }
  }
  @container (max-width: 380px) {
    .preview-topline,
    figcaption {
      padding-inline: 1rem;
    }
    .project-art {
      padding-inline: 1rem;
    }
    /*
      Three package columns do not survive a phone-width study: at 320px the
      figure is 228px wide, so each column is 59px and the longest name and the
      longest word both break mid-word. Stacking them gives every package its own
      full-width line, which keeps the names and the descriptions readable and
      keeps the study's own column honest.
    */
    .boundary-packages {
      grid-template-columns: 1fr;
      gap: 0.75rem;
      text-align: left;
    }
    .boundary-packages li {
      justify-items: start;
      grid-template-columns: auto 1fr;
      align-items: baseline;
      text-align: left;
      column-gap: 0.5rem;
      padding-inline: 0;
    }
    .boundary-point {
      grid-row: 1 / span 2;
      margin-top: 0;
      align-self: center;
    }
    .boundary-packages li > span:last-child {
      max-width: none;
    }
    /* Stacked packages have no three columns for the tree to connect, so the
       connector rules would point at nothing. */
    .boundary-connectors {
      display: none;
    }
    [data-kind="compose"] .project-art {
      grid-template-columns: 1fr;
      padding-bottom: 1.5rem;
    }
    .compose-port {
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .compose-services {
      grid-template-columns: 1fr;
    }
    .compose-service {
      padding: 0.75rem;
    }
    /* Two columns of service cards at 320px break both container names and the
       image tag mid-word, so the stack reads as one column instead. */
    .compose-service strong,
    .compose-image {
      overflow-wrap: break-word;
    }
    .lifecycle-steps {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.2rem 0.75rem;
    }
  }
  /*
    The study's nodes start hidden while the controller owns the section and are
    drawn in by it, so the first frame of a panel is never a half-painted study.
    The gate is the same pre-paint reservation the layout uses, plus the motion
    preference — not `html.motion`, which belongs to the page-reveal module and
    would hide the studies whenever that module's timing changed.
  */
  @media (prefers-reduced-motion: no-preference) {
    :global(html.work-preview) [data-art-node] {
      opacity: 0;
    }
  }
</style>
