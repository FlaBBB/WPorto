<script lang="ts">
  import { onMount } from "svelte";

  /**
   * A much sparser continuation of the opening star field. One lightweight local
   * layer is mounted per lower section (and the footer), clipped to that section
   * and painted above its background but under its content. It is deliberately
   * not a canvas: a handful of DOM spans animated with CSS transform/opacity,
   * which keeps the local fullscreen-canvas cost off the lower page.
   *
   * Positions are seeded per section, so sections do not repeat the same layout.
   * Star offsets are fixed in px at mount, so a ledger row changing a section's
   * height never moves the stars. The layer is decorative: aria-hidden,
   * pointer-events none, and motion pauses under reduced motion and while the
   * document is hidden.
   */

  // Same glyph set as the opening sculpture.
  const GLYPHS = ["+", "·", "•", "✳", "✦", "⋆", "✧", "﹡", "⋅", "✶", "*", "⁕"];
  const INK = "#ece8f4";
  // Plum ink, for the violet contact band.
  const PLUM = "#1b1430";

  let { seed = 0, tone = "ink" } = $props<{
    seed?: number;
    tone?: "ink" | "plum";
  }>();

  let host: HTMLDivElement;

  /** Deterministic pseudo-random in [0,1) from an index and salt. */
  function rand(index: number, salt: number) {
    let value = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }

  onMount(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const height = Math.max(1, host.clientHeight);
    // A small per-section budget based on height: only a few stars per section,
    // far below the opening's density.
    const count = Math.max(2, Math.min(4, Math.round(height / 600)));
    // Use the section's real height for star offsets: the 2-4 node budget
    // already bounds density, so long mobile sections keep stars all the way
    // down instead of leaving the lower part empty.
    const band = height;
    const ink = tone === "plum" ? PLUM : INK;
    const base = seed * 17 + 1;

    const glyphs = new Array<number>(count);
    const periods = new Array<number>(count);
    const nodes = new Array<HTMLSpanElement>(count);

    for (let index = 0; index < count; index += 1) {
      const star = document.createElement("span");
      star.className = "star";
      star.setAttribute("aria-hidden", "true");

      const glyph = Math.floor(rand(index, base + 1) * GLYPHS.length);
      glyphs[index] = glyph;
      periods[index] = 3 + Math.floor(rand(index, base + 2) * 7);
      star.textContent = GLYPHS[glyph];

      const size = 10 + rand(index, base + 3) * 12;
      // Peak alpha is bounded so a star drifting under text cannot push
      // foreground contrast below 4.5:1: ~0.14 for the dark plum surfaces,
      // ~0.18 for the violet contact band (solid ink stays >=4.78:1).
      const peak = tone === "plum" ? 0.18 : 0.14;
      const min =
        tone === "plum"
          ? 0.06 + rand(index, base + 4) * 0.04
          : 0.04 + rand(index, base + 4) * 0.04;
      const max = min + (peak - min) * (0.5 + rand(index, base + 5) * 0.5);

      star.style.left = `${(0.05 + rand(index, base + 7) * 0.9) * 100}%`;
      // Fixed px offset within the section's own band: later height changes do
      // not move an already-placed star.
      star.style.top = `${(0.04 + rand(index, base + 8) * 0.92) * band}px`;
      star.style.fontSize = `${size.toFixed(1)}px`;
      star.style.color = ink;
      star.style.setProperty("--min", min.toFixed(3));
      star.style.setProperty("--max", max.toFixed(3));
      star.style.setProperty("--dx", `${((rand(index, base + 9) - 0.5) * 26).toFixed(1)}px`);
      star.style.setProperty("--dy", `${((rand(index, base + 10) - 0.5) * 22).toFixed(1)}px`);
      star.style.setProperty("--dur", `${(9 + rand(index, base + 11) * 14).toFixed(1)}s`);
      star.style.setProperty("--twinkle", `${(5 + rand(index, base + 12) * 9).toFixed(1)}s`);
      star.style.animationDelay = `${(-rand(index, base + 13) * 12).toFixed(2)}s`;

      nodes[index] = star;
      host.append(star);
    }

    let interval = 0;
    let ticks = 0;
    let paused = false;

    function setPaused(next: boolean) {
      paused = next;
      // Pause the CSS drift/twinkle as well as the glyph clock, so a hidden
      // document costs nothing.
      host.classList.toggle("paused", paused);
    }

    function startGlyphs() {
      if (interval || motionQuery.matches || paused) return;
      interval = window.setInterval(() => {
        ticks += 1;
        for (let index = 0; index < count; index += 1) {
          if (ticks % periods[index] !== 0) continue;
          glyphs[index] = (glyphs[index] + 1) % GLYPHS.length;
          nodes[index].textContent = GLYPHS[glyphs[index]];
        }
      }, 240);
    }
    function stopGlyphs() {
      if (interval) window.clearInterval(interval);
      interval = 0;
    }

    function handleVisibility() {
      setPaused(document.hidden);
      if (document.hidden) stopGlyphs();
      else startGlyphs();
    }
    function handlePreference() {
      if (motionQuery.matches) stopGlyphs();
      else startGlyphs();
    }

    // Initialise through the visibility handler, so a page first hydrated in a
    // hidden tab starts with both the CSS motion and the glyph clock paused.
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    motionQuery.addEventListener("change", handlePreference);

    return () => {
      stopGlyphs();
      document.removeEventListener("visibilitychange", handleVisibility);
      motionQuery.removeEventListener("change", handlePreference);
      for (const node of nodes) node.remove();
    };
  });
</script>

<div class="starfield" aria-hidden="true" bind:this={host}></div>

<style>
  .starfield {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    /* Sits above the section's own background but under its in-flow content,
       because the section isolates its own stacking context. */
    z-index: -1;
    contain: layout paint;
  }
  /* The spans are built in JS, so they cannot take a Svelte scoped class. */
  :global(.starfield .star) {
    position: absolute;
    line-height: 1;
    opacity: var(--min, 0.1);
    will-change: transform, opacity;
  }
  @media (prefers-reduced-motion: no-preference) {
    :global(.starfield .star) {
      animation:
        star-drift var(--dur, 16s) ease-in-out infinite alternate,
        star-twinkle var(--twinkle, 8s) ease-in-out infinite alternate;
    }
  }
  /* Hidden document: freeze the CSS motion too, not just the glyph clock. */
  :global(.starfield.paused .star) {
    animation-play-state: paused;
  }
  @keyframes star-drift {
    from {
      transform: translate3d(0, 0, 0);
    }
    to {
      transform: translate3d(var(--dx, 0px), var(--dy, 0px), 0);
    }
  }
  @keyframes star-twinkle {
    from {
      opacity: var(--min, 0.08);
    }
    to {
      opacity: var(--max, 0.24);
    }
  }
</style>
