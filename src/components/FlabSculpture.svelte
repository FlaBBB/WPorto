<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";
  import { FLAB_PATH, FLAB_FILL_RULE, FLAB_VIEWBOX } from "../lib/flabMark";

  /**
   * The hero sculpture is a canvas star field whose assembled target is sampled
   * from the same filled `flab` geometry that renders the header logo, so the
   * gathered shape is the real mark rather than an approximation.
   *
   * Depth is a genuine 3D projection: particles carry a z coordinate, the body
   * rotates with the pointer, and a perspective divide drives scale, opacity and
   * glyph weight. The sky is deliberately far wider than the mark so the
   * assembled silhouette is never left visible while scattered.
   */

  const FOCAL_LENGTH = 1000;
  const MAX_DPR = 2;
  const DESKTOP_PARTICLES = 900;
  const MOBILE_PARTICLES = 420;
  const SAMPLE_GRID = 4.4;

  const GLYPHS = ["+", "·", "•", "✳", "✦", "⋆", "✧", "﹡", "⋅", "✶", "*", "⁕"];
  const DENSE_GLYPHS = new Set(["•", "✳", "✦", "✧", "﹡", "✶", "⁕"]);

  const ASSEMBLE_DURATION = 1.25;
  const SCATTER_DURATION = 1.1;
  const ASSEMBLE_STAGGER = 0.5;

  type Particle = {
    sx: number;
    sy: number;
    sz: number;
    tx: number;
    ty: number;
    tz: number;
    delay: number;
    glyph: number;
    glyphRate: number;
    glyphPhase: number;
    size: number;
    tone: number;
  };

  let stage: HTMLDivElement;
  let field: HTMLDivElement;
  let canvas: HTMLCanvasElement | undefined;
  let context: CanvasRenderingContext2D | undefined;

  let motionEnabled = $state(false);
  let assembled = $state(false);
  let hasCanvas = $state(false);

  let particles: Particle[] = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let running = false;
  let visible = true;
  let progress = { value: 0 };
  let tween: gsap.core.Tween | undefined;
  let pointerTarget = { x: 0, y: 0 };
  let pointerCurrent = { x: 0, y: 0 };
  let glyphClock = 0;
  let fontFamily = "ui-monospace, monospace";
  // Glyph sizes follow the fitted mark so a small viewport does not fill the
  // letterform's counters with oversized stars.
  let assembledSize = 9;
  let scatteredSize = 10;
  // Observable contracts for tests: how many distinct glyphs the field uses and
  // the maximum particle depth, so glyph variety and 3D extent are verifiable
  // rather than inferred from pixels alone.
  let glyphVariety = $state(0);
  let depthExtent = $state(0);

  let hovered = false;
  let keyboardFocus = false;
  let pinned = false;
  let keyboardIntent = false;
  let finePointer: MediaQueryList | undefined;

  const wantsAssembly = () => pinned || hovered || keyboardFocus;

  function particleCount() {
    return window.innerWidth < 760 ? MOBILE_PARTICLES : DESKTOP_PARTICLES;
  }

  /**
   * Samples the filled mark into evenly spread points in artboard coordinates.
   * The refined geometry is normalized, so no transform is applied.
   */
  function sampleTargets(): { x: number; y: number }[] {
    const probe = document.createElement("canvas");
    probe.width = FLAB_VIEWBOX.width;
    probe.height = FLAB_VIEWBOX.height;
    const ctx = probe.getContext("2d");
    if (!ctx) return [];

    const path = new Path2D(FLAB_PATH);

    const points: { x: number; y: number }[] = [];
    // Jittered grid: even coverage of the filled area without the ordering
    // artefacts a pure scanline would produce.
    for (let y = 0; y < FLAB_VIEWBOX.height; y += SAMPLE_GRID) {
      for (let x = 0; x < FLAB_VIEWBOX.width; x += SAMPLE_GRID) {
        const jx = x + (Math.random() - 0.5) * SAMPLE_GRID;
        const jy = y + (Math.random() - 0.5) * SAMPLE_GRID;
        if (ctx.isPointInPath(path, jx, jy, FLAB_FILL_RULE)) {
          points.push({ x: jx, y: jy });
        }
      }
    }
    return points;
  }

  /** Deterministic pseudo-random in [0,1) from a particle index and salt. */
  function rand(index: number, salt: number) {
    let value = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }

  function buildParticles() {
    const targets = sampleTargets();
    if (!targets.length) return;

    const count = particleCount();
    const centreX = width / 2;
    const centreY = height / 2;

    // Fit the mark to a generous share of the field, preserving its aspect.
    const fit = Math.min(
      (width * 0.62) / FLAB_VIEWBOX.width,
      (height * 0.68) / FLAB_VIEWBOX.height,
    );
    const markW = FLAB_VIEWBOX.width * fit;
    const markH = FLAB_VIEWBOX.height * fit;
    const markLeft = centreX - markW / 2;
    const markTop = centreY - markH / 2;
    const markRadius = Math.hypot(markW, markH) / 2;

    // The cloud is far wider than the mark in every direction, so no part of the
    // assembled silhouette can remain legible while scattered.
    const spreadX = Math.max(width * 0.85, markRadius * 2.6);
    const spreadY = Math.max(height * 0.85, markRadius * 2.4);
    const spreadZ = Math.max(420, markRadius * 2.2);

    // Glyphs scale with the fitted mark: a small viewport gets small stars that
    // sit inside the letterform instead of filling its counters. Scattered stars
    // stay larger because they carry the sky texture.
    assembledSize = Math.min(Math.max(14 * fit, 2.6), 13);
    scatteredSize = Math.min(Math.max(23 * fit, 6.5), 16);

    const next: Particle[] = [];
    let deepest = 0;
    for (let index = 0; index < count; index += 1) {
      const target = targets[Math.floor((index / count) * targets.length)];

      // A natural 3D cloud: mass falls off from the centre, so the sky keeps a
      // populated middle instead of a hollow ring, and the 3D depth term breaks
      // up any flat disc silhouette.
      const angle = rand(index, 1) * Math.PI * 2;
      const radius = Math.pow(rand(index, 2), 0.58);
      const flatten = 0.82 + rand(index, 11) * 0.36;
      const sz = (rand(index, 3) - 0.5) * 2 * spreadZ;
      deepest = Math.max(deepest, Math.abs(sz));

      next.push({
        sx: Math.cos(angle) * spreadX * radius,
        sy: Math.sin(angle) * spreadY * radius * flatten,
        sz,
        tx: markLeft + target.x * fit - centreX,
        ty: markTop + target.y * fit - centreY,
        // A shallow body of depth so the mark is a sculpture, not a decal.
        tz: (rand(index, 4) - 0.5) * 44,
        delay: rand(index, 5) * ASSEMBLE_STAGGER,
        glyph: Math.floor(rand(index, 6) * GLYPHS.length),
        glyphRate: 0.3 + rand(index, 7) * 0.85,
        glyphPhase: rand(index, 8) * 12,
        size: 0.7 + rand(index, 9) * 0.75,
        tone: rand(index, 10),
      });
    }
    particles = next;
    glyphVariety = new Set(next.map((particle) => particle.glyph)).size;
    depthExtent = deepest;
  }

  function easeOutCubic(value: number) {
    return 1 - (1 - value) ** 3;
  }

  function project(
    x: number,
    y: number,
    z: number,
    rotY: number,
    rotX: number,
    cx: number,
    cy: number,
  ) {
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    const scale = FOCAL_LENGTH / (FOCAL_LENGTH + z2);
    return { x: cx + x1 * scale, y: cy + y1 * scale, scale, depth: z2 };
  }

  function render() {
    if (!context || !canvas) return;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.06;
    pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.06;

    // The tilt follows the pointer and relaxes as the field disperses, so the
    // scattered sky stays calm while the assembled mark feels solid.
    const gather = progress.value;
    const rotY = pointerCurrent.x * 0.45 * gather;
    const rotX = pointerCurrent.y * 0.28 * gather;

    context.textAlign = "center";
    context.textBaseline = "middle";

    for (const particle of particles) {
      const local = Math.min(
        1,
        Math.max(0, (gather - particle.delay) / (1 - ASSEMBLE_STAGGER)),
      );
      const eased = easeOutCubic(local);

      const x = particle.sx + (particle.tx - particle.sx) * eased;
      const y = particle.sy + (particle.ty - particle.sy) * eased;
      const z = particle.sz + (particle.tz - particle.sz) * eased;

      const point = project(x, y, z, rotY, rotX, cx, cy);
      if (
        point.x < -48 ||
        point.x > width + 48 ||
        point.y < -48 ||
        point.y > height + 48
      ) {
        continue;
      }

      // Nearer particles are larger, brighter and use denser glyphs.
      const depth = Math.min(1, Math.max(0, (point.depth + 520) / 1040));
      const near = 1 - depth;
      const size =
        (scatteredSize + (assembledSize - scatteredSize) * gather) *
        particle.size *
        point.scale;
      if (size < 1.1) continue;

      const glyphIndex =
        (particle.glyph +
          Math.floor(glyphClock * particle.glyphRate + particle.glyphPhase)) %
        GLYPHS.length;
      const glyph = GLYPHS[glyphIndex];
      const dense = DENSE_GLYPHS.has(glyph);

      const baseAlpha = assembled ? 0.6 + near * 0.4 : 0.28 + near * 0.64;
      let alpha = baseAlpha * (0.5 + 0.5 * Math.min(1, point.scale));

      // Fade fully to zero at the field edge so the cloud dissolves instead of
      // ending on the clipped boundary with a flat-cut glyph.
      const edgeX = Math.min(point.x, width - point.x) / (width * 0.16);
      const edgeY = Math.min(point.y, height - point.y) / (height * 0.16);
      const edge = Math.min(1, Math.max(0, Math.min(edgeX, edgeY)));
      alpha *= edge;
      if (alpha < 0.01) continue;

      const violet = particle.tone > 0.84;
      context.fillStyle = violet
        ? `rgba(167, 139, 250, ${alpha.toFixed(3)})`
        : `rgba(236, 232, 244, ${alpha.toFixed(3)})`;

      context.font = `${dense ? 400 : 300} ${size.toFixed(1)}px ${fontFamily}`;
      context.fillText(glyph, point.x, point.y);
    }
  }

  function tick() {
    frame = 0;
    glyphClock += 1 / 60;
    render();

    const settling = Math.abs(progress.value - (assembled ? 1 : 0)) > 0.001;
    const drifting =
      Math.abs(pointerTarget.x - pointerCurrent.x) > 0.002 ||
      Math.abs(pointerTarget.y - pointerCurrent.y) > 0.002;

    if ((settling || drifting) && visible && !document.hidden) {
      frame = requestAnimationFrame(tick);
    } else {
      running = false;
    }
  }

  function start() {
    if (running || !visible || document.hidden || !motionEnabled) return;
    running = true;
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    if (!canvas) return;
    const rect = field.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    buildParticles();
    render();
  }

  function applyWantedState() {
    if (!motionEnabled) return;
    const next = wantsAssembly();
    if (next === assembled) return;
    assembled = next;
    tween?.kill();
    tween = gsap.to(progress, {
      value: next ? 1 : 0,
      duration: next ? ASSEMBLE_DURATION : SCATTER_DURATION,
      ease: next ? "power2.inOut" : "power2.out",
      overwrite: true,
    });
    start();
  }

  function handleStageEnter() {
    if (!finePointer?.matches) return;
    hovered = true;
    applyWantedState();
  }

  function handleStageLeave() {
    if (!finePointer?.matches) return;
    hovered = false;
    applyWantedState();
  }

  function handleStageMove(event: PointerEvent) {
    if (!finePointer?.matches || !motionEnabled) return;
    const rect = stage.getBoundingClientRect();
    pointerTarget.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerTarget.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    start();
  }

  function toggleAssembly() {
    if (assembled) {
      pinned = false;
      hovered = false;
      keyboardFocus = false;
    } else {
      pinned = true;
    }
    applyWantedState();
  }

  function handleStageClick(event: MouseEvent) {
    // The control has its own click handler; a tap on it also bubbles here, so
    // ignore that case or the toggle would fire twice and cancel itself out.
    const node = event.target;
    if (node instanceof Element && node.closest(".sculpture-control")) return;
    // A tap focuses the control before it clicks. Only a coarse pointer toggles
    // from the stage, so a fine-pointer hover is not double-triggered.
    if (finePointer?.matches) return;
    toggleAssembly();
  }

  function handleFocusIn() {
    // Pointer and touch focus must not assemble on its own, or a tap would
    // assemble on focus and then toggle straight back on its own click.
    if (!keyboardIntent) return;
    keyboardFocus = true;
    applyWantedState();
  }

  function handleFocusOut(event: FocusEvent) {
    const next = event.relatedTarget;
    if (next instanceof Node && stage.contains(next)) return;
    if (!keyboardFocus) return;
    keyboardFocus = false;
    applyWantedState();
  }

  onMount(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    fontFamily =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-mono")
        .trim() || fontFamily;

    function resetInput() {
      hovered = false;
      keyboardFocus = false;
      pinned = false;
      pointerTarget.x = 0;
      pointerTarget.y = 0;
      pointerCurrent.x = 0;
      pointerCurrent.y = 0;
    }

    function enableMotion() {
      resetInput();
      motionEnabled = true;
      assembled = false;
      progress.value = 0;
      if (!canvas) {
        const next = document.createElement("canvas");
        next.setAttribute("aria-hidden", "true");
        next.className = "sculpture-canvas";
        // A canvas without a 2D context can never draw, so keep the SVG mark and
        // hide the controls rather than presenting a dead stage.
        const nextContext = next.getContext("2d");
        if (!nextContext) {
          motionEnabled = false;
          return;
        }
        field.append(next);
        canvas = next;
        context = nextContext;
        hasCanvas = true;
      }
      resize();
      // If the mark could not be sampled at all, the stage would be blank; fall
      // back to the SVG mark and hide the controls instead.
      if (!particles.length) {
        canvas?.remove();
        canvas = undefined;
        context = undefined;
        hasCanvas = false;
        motionEnabled = false;
        return;
      }
      start();
    }

    function disableMotion() {
      resetInput();
      motionEnabled = false;
      assembled = false;
      progress.value = 0;
      tween?.kill();
      tween = undefined;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      running = false;
      canvas?.remove();
      canvas = undefined;
      context = undefined;
      hasCanvas = false;
    }

    function syncPreference() {
      if (motionQuery.matches) disableMotion();
      else enableMotion();
    }

    function handleKeydown() {
      keyboardIntent = true;
    }

    function handlePointerDown() {
      keyboardIntent = false;
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!motionEnabled) return;
      resize();
      start();
    });
    resizeObserver.observe(field);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (visible) start();
      },
      { threshold: 0.05 },
    );
    intersectionObserver.observe(field);

    function handleVisibility() {
      if (document.hidden) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        running = false;
      } else {
        start();
      }
    }

    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("visibilitychange", handleVisibility);
    motionQuery.addEventListener("change", syncPreference);
    syncPreference();

    return () => {
      motionQuery.removeEventListener("change", syncPreference);
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("visibilitychange", handleVisibility);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      tween?.kill();
      if (frame) cancelAnimationFrame(frame);
      canvas?.remove();
    };
  });
</script>

<div
  class="sculpture"
  bind:this={stage}
  data-assembled={assembled ? "true" : "false"}
  data-has-canvas={hasCanvas ? "true" : "false"}
  data-glyph-variety={glyphVariety}
  data-depth-extent={Math.round(depthExtent)}
  onpointerenter={handleStageEnter}
  onpointerleave={handleStageLeave}
  onpointermove={handleStageMove}
  onclick={handleStageClick}
  onfocusin={handleFocusIn}
  onfocusout={handleFocusOut}
>
  <div class="sculpture-field" bind:this={field}>
    <!--
      The filled mark ships in the server HTML and remains the reduced-motion,
      no-JavaScript and error fallback. It is the same geometry the particle
      targets are sampled from.
    -->
    <div class="flab-mark" aria-hidden="true">
      <svg viewBox={`0 0 ${FLAB_VIEWBOX.width} ${FLAB_VIEWBOX.height}`}>
        <path d={FLAB_PATH} fill="currentColor" fill-rule={FLAB_FILL_RULE} />
      </svg>
    </div>
  </div>
  <div class="sculpture-footer">
    <button
      class="sculpture-control"
      type="button"
      hidden={!motionEnabled}
      onclick={toggleAssembly}
    >
      {assembled ? "Scatter the mark" : "Assemble the mark"}
    </button>
    <p class="sculpture-hint" hidden={!motionEnabled}>
      <span class="hint-fine">Move the pointer to gather the mark</span>
      <span class="hint-coarse">Tap to assemble or scatter</span>
    </p>
  </div>
</div>

<style>
  .sculpture {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: clamp(20rem, 52vh, 34rem);
    display: flex;
    flex-direction: column;
  }
  /* Stars live only in the field, so they never run under the footer controls. */
  .sculpture-field {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .flab-mark {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--ink);
  }
  .flab-mark svg {
    width: min(62%, 34rem);
    height: auto;
  }
  /* Once the canvas owns the field, the static mark steps aside. */
  .sculpture[data-has-canvas="true"] .flab-mark {
    opacity: 0;
    visibility: hidden;
  }
  /* The canvas is created in JS, so it cannot receive Svelte's scoped class;
     without :global it would sit in flow and stretch the field. */
  :global(.sculpture-canvas) {
    position: absolute;
    inset: 0;
    display: block;
  }
  .sculpture-footer {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem 1.25rem;
    padding-top: 1.25rem;
  }
  .sculpture-control {
    display: inline-flex;
    align-items: center;
    min-height: 2.8125rem;
    padding: 0 1.1rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    background: transparent;
    color: var(--accent-ink);
    font: 500 0.8125rem/1.4 var(--font-sans);
    cursor: pointer;
    transition:
      border-color 180ms ease,
      background-color 180ms ease;
  }
  .sculpture-control:hover {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .sculpture-control:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .sculpture-control[hidden],
  .sculpture-hint[hidden] {
    display: none;
  }
  .sculpture-hint {
    color: var(--muted-ink);
    font: 0.8125rem/1.5 var(--font-sans);
  }
  .hint-fine {
    display: none;
  }
  @media (hover: hover) and (pointer: fine) {
    .hint-fine {
      display: inline;
    }
    .hint-coarse {
      display: none;
    }
  }
</style>
