<script lang="ts">
  import { onMount } from "svelte";
  import { FLAB_PATH, FLAB_FILL_RULE, FLAB_VIEWBOX } from "../lib/flabMark";
  import {
    AMBIENT_DPR,
    buildField,
    clamp01,
    easeOutCubic,
    GATHER_STAGGER,
    MAX_DPR,
    MAX_ROT_X,
    MAX_ROT_Y,
    project,
    type Field,
  } from "../lib/sculptureField";
  import {
    AMBIENT_VIOLET_TONE,
    DENSE_GLYPHS,
    FIELD_VIOLET_TONE,
    GLYPHS,
    starColor,
  } from "../lib/stars";

  /**
   * The opening sculpture. Its assembled target is sampled from the same filled
   * `flab` geometry that renders the header logo, so the gathered shape is the
   * real mark rather than an approximation.
   *
   * Motion is driven by native scroll only. The section is a sticky scene whose
   * scroll progress breaks the mark into a depth-varied star cloud; reversing the
   * scroll reforms it, and then the scene leaves. There is no hold: the mark starts
   * breaking on the first scrolled pixel, so the gesture is continuous with the
   * page rather than a state the visitor has to enter and leave.
   *
   * A second, sparse ambient population drifts on its own clock behind the mark so
   * the sky stays alive at rest without touching the mark's legibility.
   */

  let scene: HTMLDivElement;
  let sticky: HTMLDivElement;
  let field: HTMLDivElement;
  let canvas: HTMLCanvasElement | undefined;
  let context: CanvasRenderingContext2D | undefined;
  let ambientCanvas: HTMLCanvasElement | undefined;
  let ambientContext: CanvasRenderingContext2D | undefined;

  let motionEnabled = $state(false);
  let collapsed = $state(false);
  // Published as `data-gather` for the tests and for the stylesheet: 1 is fully
  // assembled, 0 fully scattered.
  let built = $state.raw<Field | undefined>(undefined);
  let width = $state(0);
  let height = $state(0);
  let dpr = 1;
  let ambientDpr = 1;

  /**
   * How far the mark is broken apart, from the scroll position alone.
   *
   * Scroll is the only input, so this is written by the scroll handler rather than
   * eased toward a target: a tween here would lag the page and read as the mark
   * drifting behind the visitor's own scroll.
   */
  let gather = $state(1);
  let frame = 0;
  let scrollFrame = 0;
  let running = false;
  let visible = true;
  let clock = 0;
  let lastTick = 0;

  // The field's body rotation. It is published so the render and the labels agree
  // on where the cloud is pointing.
  let bodyRotationY = $state(0);

  // Magnetic pull on the mark, in field coordinates relative to the centre.
  let tetherOn = false;
  let tetherReadyAt = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerAt = 0;
  let tetherTarget = { x: 0, y: 0 };
  let tetherOffset = { x: 0, y: 0 };
  let tetherDistance = $state(0);

  let fineHoverQuery: MediaQueryList | undefined;
  let fontFamily = "ui-monospace, monospace";

  /**
   * Magnetic pull on the central mark.
   *
   * The pull is the assembled mark leaning toward a nearby pointer. Scrolling is
   * what breaks the mark apart, so the pull only applies while the mark is still
   * substantially assembled: past that there is no letterform for it to lean.
   * The pull never closes more than a third of the gap, so the mark can never end
   * up stuck to the pointer, and the enter/exit radii differ so a pointer hovering
   * on the boundary cannot flicker the pull on and off.
   */
  const TETHER_MIN_GATHER = 0.6;
  const TETHER_ENTER_RADIUS = 80;
  const TETHER_EXIT_RADIUS = 160;
  const TETHER_MAX_SHARE = 0.45;
  /**
   * Hard cap in px. The share ramp already leaves most of the gap at the useful
   * distances; the cap covers the case where the pointer is nearly on the centre,
   * so the mark can never end up glued to it.
   */
  const TETHER_MAX_OFFSET = 22;
  const TETHER_FOLLOW = 0.2;
  const TETHER_COOLDOWN_MS = 400;
  const TETHER_SPEED_LIMIT = 1000;

  function renderMain() {
    if (!context || !canvas || !built) return;
    const { particles, spreadZ, focalLength, assembledSize, scatteredSize } = built;

    // A jump can leave the scene before IntersectionObserver delivers its update.
    const viewportBox = field.getBoundingClientRect();
    if (viewportBox.bottom <= 0 || viewportBox.top >= window.innerHeight) return;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // A gentle body rotation as the field opens up, so the cloud reads as a
    // volume. It relaxes to zero at full assembly, keeping the mark stable. The
    // amplitudes match MAX_ROT_* that the projection bound is derived from.
    const opening = 1 - gather;
    const rotY = bodyRotationY;
    const rotX = Math.cos(clock * 0.09) * MAX_ROT_X * opening;

    context.textAlign = "center";
    context.textBaseline = "middle";

    for (const particle of particles) {
      const local = clamp01((gather - particle.delay) / (1 - GATHER_STAGGER));
      const eased = easeOutCubic(local);

      let x = particle.sx + (particle.tx - particle.sx) * eased;
      let y = particle.sy + (particle.ty - particle.sy) * eased;
      const z = particle.sz + (particle.tz - particle.sz) * eased;

      // The magnetic pull moves the whole mark, so it is applied as one offset to
      // every particle. Only the mark leans; the ambient sky behind it stays put.
      x += tetherOffset.x;
      y += tetherOffset.y;

      const point = project(x, y, z, rotY, rotX, focalLength, cx, cy);
      if (!point) continue;
      if (
        point.x < -48 ||
        point.x > width + 48 ||
        point.y < -48 ||
        point.y > height + 48
      ) {
        continue;
      }

      // Nearer particles are larger, brighter and use denser glyphs.
      const depth = clamp01((point.depth + spreadZ) / (2 * spreadZ));
      const near = 1 - depth;
      const size =
        (scatteredSize + (assembledSize - scatteredSize) * gather) *
        particle.size *
        point.scale;
      if (size < 1.1) continue;

      const glyphIndex =
        (particle.glyph +
          Math.floor(clock * particle.glyphRate + particle.glyphPhase)) %
        GLYPHS.length;
      const glyph = GLYPHS[glyphIndex];
      const dense = DENSE_GLYPHS.has(glyph);

      const scatteredAlpha = 0.3 + near * 0.62;
      const assembledAlpha = 0.62 + near * 0.38;
      const baseAlpha =
        scatteredAlpha + (assembledAlpha - scatteredAlpha) * gather;
      let alpha = baseAlpha * (0.5 + 0.5 * Math.min(1, point.scale));

      // Fade fully to zero at the field edge so the cloud dissolves instead of
      // ending on the clipped boundary with a flat-cut glyph.
      const edgeX = Math.min(point.x, width - point.x) / (width * 0.16);
      const edgeY = Math.min(point.y, height - point.y) / (height * 0.16);
      const edge = clamp01(Math.min(edgeX, edgeY));
      alpha *= edge;
      if (alpha < 0.01) continue;

      context.fillStyle = starColor(particle.tone, alpha, FIELD_VIOLET_TONE);

      context.font = `${dense ? 400 : 300} ${size.toFixed(1)}px ${fontFamily}`;
      context.fillText(glyph, point.x, point.y);
    }
  }

  function renderAmbient(seconds: number) {
    if (!ambientContext || !ambientCanvas) return;

    ambientContext.setTransform(ambientDpr, 0, 0, ambientDpr, 0, 0);
    ambientContext.clearRect(0, 0, width, height);
    ambientContext.textAlign = "center";
    ambientContext.textBaseline = "middle";

    for (const star of built?.ambient ?? []) {
      const x = star.ax + Math.sin(seconds * star.freqX + star.phaseX) * star.amp;
      const y = star.ay + Math.cos(seconds * star.freqY + star.phaseY) * star.amp;
      if (x < -32 || x > width + 32 || y < -32 || y > height + 32) continue;

      const glyphIndex =
        (star.glyph +
          Math.floor(seconds * star.glyphRate + star.glyphPhase)) %
        GLYPHS.length;
      const glyph = GLYPHS[glyphIndex];
      const pulse = 0.62 + 0.38 * Math.sin(seconds * star.alphaFreq + star.alphaPhase);
      const alpha = star.baseAlpha * pulse;
      if (alpha < 0.01) continue;

      ambientContext.fillStyle = starColor(star.tone, alpha, AMBIENT_VIOLET_TONE);
      const dense = DENSE_GLYPHS.has(glyph);
      ambientContext.font = `${dense ? 400 : 300} ${star.size.toFixed(1)}px ${fontFamily}`;
      ambientContext.fillText(glyph, x, y);
    }
  }

  function tick(now: number) {
    frame = 0;
    // performance.now() is a monotonic clock, so the ambient drift and glyph
    // rotation are refresh-rate independent and never accumulate frame drift.
    clock = now / 1000;

    const delta = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0;
    lastTick = now;

    // One rotation drives the whole field, so the stars cannot drift away from the
    // mark they belong to.
    bodyRotationY = Math.sin(clock * 0.12) * MAX_ROT_Y * (1 - gather);

    // The pull eases with a frame-rate independent lerp rather than a spring, so a
    // dropped frame cannot overshoot or ring. 0.2 per 60fps frame matches the
    // TETHER_FOLLOW budget.
    if (tetherOffset.x !== tetherTarget.x || tetherOffset.y !== tetherTarget.y) {
      const follow = 1 - Math.pow(1 - TETHER_FOLLOW, delta * 60);
      tetherOffset = {
        x: tetherOffset.x + (tetherTarget.x - tetherOffset.x) * follow,
        y: tetherOffset.y + (tetherTarget.y - tetherOffset.y) * follow,
      };
      // Snap the last fraction so the mark always comes fully to rest.
      if (Math.abs(tetherTarget.x - tetherOffset.x) < 0.05) tetherOffset.x = tetherTarget.x;
      if (Math.abs(tetherTarget.y - tetherOffset.y) < 0.05) tetherOffset.y = tetherTarget.y;
      const pull = Math.round(Math.hypot(tetherOffset.x, tetherOffset.y));
      if (pull !== tetherDistance) tetherDistance = pull;
    }

    renderAmbient(clock);
    renderMain();

    if (motionEnabled && visible && !document.hidden) {
      frame = requestAnimationFrame(tick);
    } else {
      running = false;
    }
  }

  function start() {
    if (running || !motionEnabled || !visible || document.hidden) return;
    running = true;
    // Drop the stale clock so a restarted loop does not fold the idle time into
    // one oversized step.
    lastTick = 0;
    frame = requestAnimationFrame(tick);
  }

  function sizeCanvas(target: HTMLCanvasElement, ratio: number) {
    target.width = Math.max(1, Math.round(width * ratio));
    target.height = Math.max(1, Math.round(height * ratio));
    target.style.width = `${width}px`;
    target.style.height = `${height}px`;
  }

  function resize() {
    if (!canvas || !ambientCanvas) return;
    const rect = field.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const ratio = window.devicePixelRatio || 1;
    dpr = Math.min(ratio, MAX_DPR);
    ambientDpr = Math.min(ratio, AMBIENT_DPR);
    sizeCanvas(canvas, dpr);
    sizeCanvas(ambientCanvas, ambientDpr);
    built = buildField(width, height);
    renderAmbient(clock);
    renderMain();
  }

  /**
   * Native scroll is the only input: the mark is fully gathered at the top of the
   * scene and fully dispersed by the time the sticky scene leaves. Reading the
   * live geometry keeps direct hashes, resizes, quick reversals and back-to-top in
   * sync.
   */
  function computeGather() {
    if (!scene || !sticky) return;
    const total = scene.offsetHeight - sticky.offsetHeight;
    const scrolled = -scene.getBoundingClientRect().top;
    const progress = total > 4 ? clamp01(scrolled / total) : 0;
    const eased = progress * progress * (3 - 2 * progress);
    const next = 1 - eased;
    if (Math.abs(next - gather) > 0.0005) gather = next;
  }

  function releaseTether(now: number) {
    tetherOn = false;
    tetherTarget = { x: 0, y: 0 };
    // A short cooldown keeps the pull from re-arming the instant the pointer
    // crosses back over the boundary it just left.
    tetherReadyAt = (now || performance.now()) + TETHER_COOLDOWN_MS;
    start();
  }

  /**
   * Magnetic pull. The mark leans toward the pointer while it is near the centre
   * and still assembled, which is the phase where the visitor is aiming at the
   * mark rather than at content. Pointer speed, leaving the outer radius, scrolling
   * and a blurred window all release it, and it never runs for touch or under
   * reduced motion.
   */
  function handlePointerMove(event: PointerEvent) {
    if (
      event.pointerType !== "mouse" ||
      !motionEnabled ||
      !fineHoverQuery?.matches ||
      gather < TETHER_MIN_GATHER
    ) {
      releaseTether(event.timeStamp);
      return;
    }
    if (!field) return;

    const rect = field.getBoundingClientRect();
    const x = event.clientX - rect.left - width / 2;
    const y = event.clientY - rect.top - height / 2;
    const now = event.timeStamp || performance.now();
    const elapsed = pointerAt ? now - pointerAt : 0;
    const speed = elapsed > 0 ? Math.hypot(x - pointerX, y - pointerY) / (elapsed / 1000) : 0;
    pointerX = x;
    pointerY = y;
    pointerAt = now;

    if (speed > TETHER_SPEED_LIMIT) {
      releaseTether(now);
      return;
    }
    const distance = Math.hypot(x, y);
    if (!tetherOn && distance > TETHER_ENTER_RADIUS) return;
    if (tetherOn && distance > TETHER_EXIT_RADIUS) {
      releaseTether(now);
      return;
    }
    if (!tetherOn && now < tetherReadyAt) return;

    tetherOn = true;
    // Soft at the edge, strongest at the centre, so the mark never snaps. The cap
    // is applied to the pull vector rather than to the distance, so a pointer
    // exactly on the centre produces no direction at all instead of dividing by
    // zero.
    const proximity = clamp01(1 - distance / TETHER_EXIT_RADIUS);
    const ramp = proximity * proximity * (3 - 2 * proximity);
    const share = TETHER_MAX_SHARE * ramp;
    const pullX = x * share;
    const pullY = y * share;
    const pullLength = Math.hypot(pullX, pullY);
    const cap = pullLength > TETHER_MAX_OFFSET ? TETHER_MAX_OFFSET / pullLength : 1;
    tetherTarget = { x: pullX * cap, y: pullY * cap };
    start();
  }

  function removeCanvases() {
    canvas?.remove();
    ambientCanvas?.remove();
    canvas = undefined;
    context = undefined;
    ambientCanvas = undefined;
    ambientContext = undefined;
  }

  function enableMotion() {
    motionEnabled = true;
    collapsed = false;

    if (!canvas) {
      const nextCanvas = document.createElement("canvas");
      nextCanvas.setAttribute("aria-hidden", "true");
      nextCanvas.className = "sculpture-canvas";
      const nextContext = nextCanvas.getContext("2d");

      const nextAmbient = document.createElement("canvas");
      nextAmbient.setAttribute("aria-hidden", "true");
      nextAmbient.className = "sculpture-ambient";
      const nextAmbientContext = nextAmbient.getContext("2d");

      // A canvas without a 2D context can never draw, so keep the SVG mark and
      // collapse the scene rather than leaving a dead sticky spacer.
      if (!nextContext || !nextAmbientContext) {
        motionEnabled = false;
        collapsed = true;
        return;
      }

      field.append(nextAmbient, nextCanvas);
      ambientCanvas = nextAmbient;
      ambientContext = nextAmbientContext;
      canvas = nextCanvas;
      context = nextContext;
    }

    resize();
    // If the field could not be built at all, the stage would be blank; fall back
    // to the SVG mark and collapse the scene instead.
    if (!built) {
      removeCanvases();
      motionEnabled = false;
      collapsed = true;
      return;
    }
    computeGather();
    start();
  }

  function disableMotion() {
    motionEnabled = false;
    collapsed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    running = false;
    removeCanvases();
    tetherOn = false;
    tetherTarget = { x: 0, y: 0 };
    tetherOffset = { x: 0, y: 0 };
    tetherDistance = 0;
    bodyRotationY = 0;
    gather = 1;
  }

  onMount(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    fineHoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    fontFamily =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-mono")
        .trim() || fontFamily;

    function syncPreference() {
      if (motionQuery.matches) disableMotion();
      else enableMotion();
    }

    /**
     * Scroll drives the mark, so it is also what releases the pull: once the
     * visitor is moving the page they are no longer aiming at the mark.
     */
    function handleScroll() {
      releaseTether(0);
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        computeGather();
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!motionEnabled) return;
      resize();
      computeGather();
      start();
    });
    resizeObserver.observe(field);
    resizeObserver.observe(scene);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (visible) start();
      },
      { threshold: 0.02 },
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

    document.addEventListener("visibilitychange", handleVisibility);
    field.addEventListener("pointermove", handlePointerMove);
    field.addEventListener("pointerleave", handleScroll);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("hashchange", handleScroll);
    window.addEventListener("blur", handleScroll);
    motionQuery.addEventListener("change", syncPreference);
    syncPreference();
    // A deep link may land mid-scene, so read the live geometry once at mount.
    computeGather();

    return () => {
      motionQuery.removeEventListener("change", syncPreference);
      document.removeEventListener("visibilitychange", handleVisibility);
      field.removeEventListener("pointermove", handlePointerMove);
      field.removeEventListener("pointerleave", handleScroll);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("hashchange", handleScroll);
      window.removeEventListener("blur", handleScroll);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
      removeCanvases();
    };
  });
</script>

<div
  class="sculpture"
  data-motion={motionEnabled ? "on" : "off"}
  data-collapsed={collapsed ? "true" : "false"}
  data-gather={gather.toFixed(3)}
  data-focal={Math.round(built?.focalLength ?? 0)}
  data-depth-bound={Math.round(built?.depthBound ?? 0)}
  data-glyph-variety={built?.glyphVariety ?? 0}
  data-depth-extent={Math.round(built?.depthExtent ?? 0)}
  data-tether={tetherDistance}
>
  <div class="sculpture-scene" bind:this={scene}>
    <div class="sculpture-sticky" bind:this={sticky}>
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
    </div>
  </div>
</div>

<style>
  .sculpture {
    position: relative;
    width: 100%;
  }
  .sculpture-scene {
    position: relative;
    height: auto;
  }
  /* Static fallback: the mark sets its own height and the scene stays short. */
  .sculpture-sticky {
    position: relative;
    display: grid;
    place-items: center;
    padding-block: clamp(3.5rem, 12vh, 7rem);
  }
  .sculpture-field {
    position: relative;
    width: 100%;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .flab-mark {
    width: 100%;
    display: grid;
    place-items: center;
    color: var(--ink);
  }
  .flab-mark svg {
    width: min(66vw, 20rem);
    height: auto;
    display: block;
  }
  @media (min-width: 760px) {
    .flab-mark svg {
      width: min(44vw, 40rem);
    }
  }
  /*
    Full-motion pre-paint: match the fitted canvas mark exactly (same width
    ratio, 40rem cap and 52vh height cap) so the server SVG does not shrink or
    jump when the component hydrates. The static reduced-motion/no-JS layout
    above stays compact.
  */
  :global(html.motion) .flab-mark svg {
    width: min(66vw, 20rem, calc(52vh * 402 / 272));
    width: min(66vw, 20rem, calc(52dvh * 402 / 272));
  }
  @media (min-width: 760px) {
    :global(html.motion) .flab-mark svg {
      width: min(44vw, 40rem, calc(52vh * 402 / 272));
      width: min(44vw, 40rem, calc(52dvh * 402 / 272));
    }
  }
  /* Once the canvas owns the field, the static mark steps aside. */
  .sculpture[data-motion="on"]:not([data-collapsed="true"]) .sculpture-field {
    height: 100%;
  }
  .sculpture[data-motion="on"]:not([data-collapsed="true"]) .flab-mark {
    position: absolute;
    inset: 0;
    opacity: 0;
    visibility: hidden;
  }
  /* The canvases are created in JS, so they cannot receive Svelte's scoped
     class; without :global they would sit in flow and stretch the field. */
  :global(.sculpture-ambient),
  :global(.sculpture-canvas) {
    position: absolute;
    inset: 0;
    display: block;
  }
  :global(.sculpture-ambient) {
    z-index: 1;
  }
  :global(.sculpture-canvas) {
    z-index: 2;
  }

  /*
    The scroll scene. The section is taller than the viewport and the stage sticks
    inside it, so the visitor's own scroll is what breaks the mark apart and
    reforms it. The extra length is the gesture, so it is only claimed once there
    is a canvas to drive.

    Reserve the sticky viewport pre-paint too, so the server-rendered SVG is
    centred in the same initial full viewport and does not jump ~128px when the
    component hydrates. Collapsed overrides below win over this.
  */
  :global(html.motion) .sculpture-sticky {
    position: sticky;
    top: 0;
    height: 100vh;
    height: 100dvh;
    padding-block: 0;
  }
  .sculpture[data-motion="on"] .sculpture-scene {
    height: 225vh;
    height: 225dvh;
  }
  .sculpture[data-motion="on"] .sculpture-sticky {
    position: sticky;
    top: 0;
    height: 100vh;
    height: 100dvh;
    padding-block: 0;
  }
  /*
    Collapsed means there is no canvas to draw — no JavaScript, reduced motion,
    or an unavailable 2D context. It must win over BOTH the pre-paint reserve and
    the ready-canvas rule, so a dead sticky spacer can never remain, even if the
    page-reveal module loaded and left `html.motion` on.
  */
  :global(html.motion) .sculpture[data-collapsed="true"] .sculpture-scene,
  .sculpture[data-motion="on"][data-collapsed="true"] .sculpture-scene {
    height: auto;
  }
  :global(html.motion) .sculpture[data-collapsed="true"] .sculpture-sticky,
  .sculpture[data-motion="on"][data-collapsed="true"] .sculpture-sticky {
    position: relative;
    height: auto;
    padding-block: clamp(3.5rem, 12vh, 7rem);
  }
</style>
