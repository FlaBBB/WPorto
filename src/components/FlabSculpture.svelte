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
  import {
    beaconPosition,
    type MapPhase,
    type SectionDestination,
  } from "../lib/sectionMap";

  /**
   * The opening sculpture. Its assembled target is sampled from the same filled
   * `flab` geometry that renders the header logo, so the gathered shape is the
   * real mark rather than an approximation.
   *
   * The mark is the section map's control, not a scroll effect. The opening is
   * exactly one viewport tall and the page never moves it: activating the mark
   * breaks it into a depth-varied star cloud, with the impulse radiating from the
   * activation point, and four destination stars settle into a constellation
   * around it. Choosing a destination returns to the page; Escape, the close
   * control, or a click on empty sky reforms the mark.
   *
   * Navigation is never canvas-only. The destination stars are real links in the
   * document, so keyboard, screen readers, reduced motion and a missing bundle
   * all reach the same four sections; the canvas stays aria-hidden and only draws
   * the sky and the constellation edges.
   *
   * A second, sparse ambient population drifts on its own clock behind the mark
   * so the sky stays alive at rest without touching the mark's legibility.
   */

  let { destinations = [] } = $props<{
    destinations?: SectionDestination[];
  }>();

  let scene: HTMLDivElement;
  let sticky: HTMLDivElement;
  let field: HTMLDivElement;
  let control: HTMLButtonElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let context: CanvasRenderingContext2D | undefined;
  let ambientCanvas: HTMLCanvasElement | undefined;
  let ambientContext: CanvasRenderingContext2D | undefined;

  let motionEnabled = $state(false);
  let collapsed = $state(false);
  // The built field: particles, ambient sky, and every projection constant. It is
  // rebuilt whenever the stage changes size, and undefined means the stage could
  // not be built at all.
  //
  // `$state.raw` matters here: the field holds hundreds of particle objects that
  // the render loop only ever reads, so a deep reactive proxy would add cost to
  // every frame without ever being useful. Reassignment is what the template
  // needs, and that is exactly what raw state provides.
  let built = $state.raw<Field | undefined>(undefined);
  let width = $state(0);
  let height = $state(0);
  let dpr = 1;
  let ambientDpr = 1;
  // 1 = the mark is assembled, 0 = it is fully scattered. It is driven by the
  // section map's own state machine, never by the page's scroll position.
  let gather = $state(1);
  let mapOpen = $state(false);
  // The four links exist as soon as the map opens, but they only take pointer
  // events once the scatter has settled, so a target still in flight can never be
  // clicked by accident.
  let mapSettled = $state(false);
  const mapPhase = $derived<MapPhase>(
    mapOpen ? (mapSettled ? "open" : "opening") : "closed",
  );
  let frame = 0;
  let running = false;
  let visible = true;
  let clock = 0;
  // The per-frame clock is needed to advance the assemble/scatter transition and
  // to decay the activation impulse independently of the frame rate.
  let lastTick = 0;
  // Target the drawn pose eases toward; the tween itself lives in `tick`, so the
  // pose keeps moving even when no new event arrives.
  let gatherTarget = 1;
  // Activation impulse, in field coordinates relative to the centre.
  let impulseX = 0;
  let impulseY = 0;
  let impulse = 0;
  // Magnetic pull on the mark, in field coordinates relative to the centre.
  let tetherOn = false;
  let tetherReadyAt = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerAt = 0;
  let tetherTarget = { x: 0, y: 0 };
  let tetherOffset = { x: 0, y: 0 };
  let settleTimer = 0;
  // Observable contract for tests: the live pull in whole px, written only when it
  // changes so the attribute is not touched on every frame.
  let tetherDistance = $state(0);
  // Set on mount: the pointer handlers only run in the browser, so the query is
  // never read during the server render.
  let fineHoverQuery: MediaQueryList | undefined;
  let fontFamily = "ui-monospace, monospace";

  /** Seconds for a full transition in each direction. */
  const SCATTER_SECONDS = 0.72;
  const ASSEMBLE_SECONDS = 0.75;
  const IMPULSE_SECONDS = 0.9;
  /**
   * The destination stars are links, so a target that is still flying must not be
   * clickable: the map takes pointer events only once the scatter has settled.
   */
  const SCATTER_SETTLE_MS = SCATTER_SECONDS * 1000;

  /**
   * Magnetic pull on the central mark. The destination stars stay still; only the
   * mark leans toward the pointer, which is the phase where there is no link to
   * mis-hit. The pull never closes more than a third of the gap, so the mark can
   * never end up stuck to the pointer, and the enter/exit radii differ so a
   * pointer hovering on the boundary cannot flicker the pull on and off.
   */
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
    const rotY = Math.sin(clock * 0.12) * MAX_ROT_Y * opening;
    const rotX = Math.cos(clock * 0.09) * MAX_ROT_X * opening;

    context.textAlign = "center";
    context.textBaseline = "middle";

    // The constellation edges fade in with the scatter, so the four destinations
    // read as one figure rather than four unrelated stars. The canvas only draws
    // the figure; the labels and hit areas stay in the document.
    const openness = 1 - gather;
    if (openness > 0.05 && destinations.length > 1) {
      context.strokeStyle = `rgba(167, 139, 250, ${(openness * 0.3).toFixed(3)})`;
      context.lineWidth = 1;
      context.beginPath();
      // Consecutive destinations only, in reading order: a path reads as a
      // constellation, whereas closing the loop adds an edge that crosses the
      // others and makes the figure harder to read.
      for (let index = 0; index < destinations.length - 1; index += 1) {
        const from = beaconPosition(index, width, height);
        const to = beaconPosition(index + 1, width, height);
        if (index === 0) context.moveTo(cx + from.x, cy + from.y);
        context.lineTo(cx + to.x, cy + to.y);
      }
      context.stroke();
    }

    for (const particle of particles) {
      const local = clamp01((gather - particle.delay) / (1 - GATHER_STAGGER));
      const eased = easeOutCubic(local);

      let x = particle.sx + (particle.tx - particle.sx) * eased;
      let y = particle.sy + (particle.ty - particle.sy) * eased;
      const z = particle.sz + (particle.tz - particle.sz) * eased;

      // The activation impulse pushes nearby particles outward from the point the
      // visitor pressed, so the break reads as a shock rather than a dissolve.
      if (impulse > 0) {
        const dx = x - impulseX;
        const dy = y - impulseY;
        const distance = Math.hypot(dx, dy) || 1;
        const push =
          impulse * 130 * Math.exp(-distance / (Math.min(width, height) * 0.45));
        x += (dx / distance) * push;
        y += (dy / distance) * push;
      }

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

    // The assemble/scatter transition and the impulse decay advance from real
    // elapsed time, so a slow frame stretches them instead of skipping them.
    const delta = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0;
    lastTick = now;
    if (gather !== gatherTarget) {
      const seconds = gatherTarget < gather ? SCATTER_SECONDS : ASSEMBLE_SECONDS;
      const step = delta / seconds;
      gather =
        Math.abs(gatherTarget - gather) <= step
          ? gatherTarget
          : gather + Math.sign(gatherTarget - gather) * step;
    }
    if (impulse > 0) impulse = Math.max(0, impulse - delta / IMPULSE_SECONDS);

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
   * A destination star's position in field coordinates, measured from the stage
   * centre. It is derived from the live stage size, so the constellation keeps its
   * spread from a phone through a wide desktop and the labels stay clear of both
   * the header and the viewport edge.
   */
  /** Break the mark apart, radiating the impulse from the activation point. */
  function openMap(event?: MouseEvent) {
    if (!motionEnabled || mapOpen) return;
    releaseTether(0);
    // A keyboard activation synthesizes a click at (0, 0); only a real pointer
    // click carries a position, so only that one seeds the impulse.
    if (event && event.detail > 0 && field) {
      const rect = field.getBoundingClientRect();
      impulseX = event.clientX - rect.left - width / 2;
      impulseY = event.clientY - rect.top - height / 2;
      impulse = 1;
    }
    mapOpen = true;
    mapSettled = false;
    gatherTarget = 0;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      settleTimer = 0;
      mapSettled = true;
    }, SCATTER_SETTLE_MS);
    start();
  }

  function closeMap() {
    if (!mapOpen) return;
    mapOpen = false;
    mapSettled = false;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = 0;
    gatherTarget = 1;
    start();
  }

  /** The mark is the control: activating it opens, activating it again closes. */
  function toggleMap(event: MouseEvent) {
    if (mapOpen) closeMap();
    else openMap(event);
  }

  /**
   * Clicking empty sky reforms the mark. The destination stars and the close
   * control own their own clicks, so choosing a section never closes first.
   */
  function handleFieldClick(event: MouseEvent) {
    if (!mapOpen) return;
    const node = event.target;
    if (node instanceof Element && node.closest("a, button")) return;
    closeMap();
  }

  /**
   * Choosing a destination hands over to the section. The hash is what moves the
   * page — the star is an ordinary link — and the focus hand-off happens on
   * `hashchange` rather than here, so the browser's own hash handling, scrolling
   * included, is already done and cannot take focus back. `preventScroll` keeps
   * the browser's own hash position, which `scroll-margin-top` has already
   * cleared of the header.
   */
  function handleStarClick() {
    closeMap();
  }

  /**
   * Move focus to the section heading the page just navigated to. Running on
   * `hashchange` rather than in a click handler makes the hand-off deterministic
   * across engines, and it covers every route to a section: the constellation,
   * the footer's static list, and a deep link.
   */
  function handleHashChange() {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const destination = destinations.find((entry) => entry.id === id);
    if (!destination) return;
    document.getElementById(destination.headingId)?.focus({ preventScroll: true });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !mapOpen) return;
    closeMap();
    // Focus returns to the control the visitor opened the map from, so Escape
    // never drops focus onto the document body.
    control?.focus();
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
   * A keyboard visitor has no pointer, so the pull is meaningless and would only
   * shift the target they are tabbing to. The equivalent cue is the star's own
   * hover/focus enlargement and focus ring.
   */
  function releaseOnFocus() {
    releaseTether(0);
  }

  /**
   * Magnetic pull. The mark leans toward the pointer while it is near the centre,
   * which is the phase where the visitor is aiming at the mark rather than at a
   * link. Pointer speed, leaving the outer radius, Escape, a click, scrolling and
   * a blurred window all release it, and it never runs for touch, for a keyboard
   * journey, or under reduced motion.
   */
  function handlePointerMove(event: PointerEvent) {
    if (
      event.pointerType !== "mouse" ||
      !motionEnabled ||
      mapOpen ||
      !fineHoverQuery?.matches
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
    start();
  }

  function disableMotion() {
    motionEnabled = false;
    collapsed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    running = false;
    removeCanvases();
    // Without a canvas there is nothing to scatter, so the map falls back to the
    // plain list of links the server already shipped.
    mapOpen = false;
    mapSettled = false;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = 0;
    gatherTarget = 1;
    impulse = 0;
    tetherOn = false;
    tetherTarget = { x: 0, y: 0 };
    tetherOffset = { x: 0, y: 0 };
    tetherDistance = 0;
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

    // Any of these means the visitor is no longer aiming at the mark, so the pull
    // lets go. They only ever release it; none of them animates from scroll.
    function releaseOnChange() {
      releaseTether(0);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!motionEnabled) return;
      resize();
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

    // The map is an overlay on a one-viewport opening, so it never follows the
    // page's scroll position: only its own control, Escape, or empty sky closes
    // it. Nothing here reads or writes scroll; the scroll listener exists only to
    // let go of the magnetic pull once the hero starts leaving.
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("hashchange", handleHashChange);
    field.addEventListener("pointermove", handlePointerMove);
    field.addEventListener("pointerleave", releaseOnChange);
    window.addEventListener("scroll", releaseOnChange, { passive: true });
    window.addEventListener("blur", releaseOnChange);
    motionQuery.addEventListener("change", syncPreference);
    syncPreference();

    return () => {
      motionQuery.removeEventListener("change", syncPreference);
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("hashchange", handleHashChange);
      field.removeEventListener("pointermove", handlePointerMove);
      field.removeEventListener("pointerleave", releaseOnChange);
      window.removeEventListener("scroll", releaseOnChange);
      window.removeEventListener("blur", releaseOnChange);
      if (settleTimer) clearTimeout(settleTimer);
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
  data-map={mapPhase}
  data-gather={gather.toFixed(3)}
  data-focal={Math.round(built?.focalLength ?? 0)}
  data-depth-bound={Math.round(built?.depthBound ?? 0)}
  data-glyph-variety={built?.glyphVariety ?? 0}
  data-depth-extent={Math.round(built?.depthExtent ?? 0)}
  data-tether={tetherDistance}
>
  <div class="sculpture-scene" bind:this={scene}>
    <div class="sculpture-sticky" bind:this={sticky}>
      <div class="sculpture-field" bind:this={field} onclick={handleFieldClick}>
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

        <!--
          The mark is the control. Closed, it is laid over the fitted letterform so
          the mark itself is the target; open, it shrinks to a close affordance at
          the foot of the stage, which keeps focus on a real element instead of
          hiding the element the visitor just activated.
        -->
        {#if destinations.length && motionEnabled && !collapsed}
          <button
            class="sculpture-control"
            bind:this={control}
            type="button"
            style={`--mark-width: ${(built?.markBox.width ?? 0).toFixed(1)}px; --mark-height: ${(built?.markBox.height ?? 0).toFixed(1)}px;`}
            aria-label={mapOpen ? "Close the section map" : "Open the section map"}
            aria-expanded={mapOpen}
            onclick={toggleMap}
            onfocus={releaseOnFocus}
          >
            <span class="sculpture-control-hint" aria-hidden="true">
              <span class="sculpture-control-glyph">✦</span>
              <span class="sculpture-control-text">
                {mapOpen ? "Close" : "Section map"}
              </span>
            </span>
          </button>
        {/if}
        <!--
          The section map. These are real links rather than canvas hit areas, so
          keyboard, screen readers, reduced motion and a missing bundle all reach
          the same sections. With motion they take their constellation positions
          once the mark breaks apart; without it they read as a plain list under
          the static mark.
        -->
        {#if destinations.length}
          <nav class="sculpture-map" aria-label="Portfolio sections">
            <ul>
              {#each destinations as destination, index (destination.id)}
                {@const position = beaconPosition(index, width, height)}
                <li
                  style={`left: ${position.x.toFixed(1)}px; top: ${position.y.toFixed(1)}px;`}
                >
                  <a
                    class="sculpture-star"
                    href={`#${destination.id}`}
                    onclick={handleStarClick}
                  >
                    <span class="sculpture-star-glyph" aria-hidden="true">✦</span>
                    <span class="sculpture-star-label">{destination.label}</span>
                  </a>
                </li>
              {/each}
            </ul>
          </nav>
        {/if}
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
    The opening is exactly one viewport and never moves. There is no scroll length
    left to scrub, so the stage is a plain block rather than a sticky scene, and
    no dead spacer can remain if the canvas never starts.
  */
  :global(html.motion) .sculpture-sticky,
  .sculpture[data-motion="on"] .sculpture-sticky {
    position: relative;
    height: 100vh;
    height: 100dvh;
    padding-block: 0;
  }

  /*
    The section map. Its links are always in the document; only their placement
    changes. With motion they sit at their constellation offsets around the stage
    centre, so the figure the canvas draws lines between is the figure the visitor
    can actually reach.

    Visual and interaction are deliberately separated: the anchor is a still hit
    area of at least 44x44px with room around the glyph, and every animated
    property lives on an inner element. A target that moves while you aim at it
    makes the visitor guess, so nothing here translates.
  */
  .sculpture-map {
    position: absolute;
    inset: 0;
    z-index: 4;
    opacity: 0;
    /* The layer spans the stage, so it must not swallow the click that closes the
       map on empty sky; only the links take pointer events. */
    pointer-events: none;
  }
  .sculpture-map ul {
    position: absolute;
    left: 50%;
    top: 50%;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .sculpture-map li {
    position: absolute;
    transform: translate(-50%, -50%);
  }
  .sculpture-star {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 2.75rem;
    min-height: 2.75rem;
    /* 8-12px of padding around the glyph, so the target is not the glyph. */
    padding: 0.5rem 0.75rem;
    color: var(--muted-ink);
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    pointer-events: auto;
  }
  .sculpture-star-glyph {
    font-size: 1.15rem;
    line-height: 1;
    color: var(--accent);
  }
  .sculpture-star-label {
    font: 500 0.72rem/1 var(--font-mono);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  @media (prefers-reduced-motion: no-preference) {
    .sculpture-map {
      transition: opacity 420ms ease;
    }
    .sculpture-star,
    .sculpture-star-glyph,
    .sculpture-control,
    .sculpture-control-glyph {
      transition:
        color 180ms ease,
        transform 220ms ease,
        background-color 180ms ease,
        border-color 180ms ease;
    }
    /*
      A slow breath marks the four destinations as stars rather than menu items.
      It is opacity only, at 4.8s, so the target never shifts; hovering or focusing
      pauses it so the star is exactly where it was when the visitor committed.
    */
    .sculpture[data-map="open"] .sculpture-star-glyph {
      animation: star-breathe 4.8s ease-in-out infinite alternate;
    }
    .sculpture-star:hover .sculpture-star-glyph,
    .sculpture-star:focus-visible .sculpture-star-glyph {
      animation-play-state: paused;
    }
  }
  .sculpture-star:hover,
  .sculpture-star:focus-visible {
    color: var(--ink);
  }
  /* Brighten and a 1.06 enlargement, on the inner glyph, never on the hit area. */
  .sculpture-star:hover .sculpture-star-glyph,
  .sculpture-star:focus-visible .sculpture-star-glyph {
    color: var(--accent-ink);
    transform: scale(1.06);
  }
  /*
    Hidden while the map is closed, so the four links cannot be tabbed to while
    they are invisible and the server-rendered list still shows when motion is
    unavailable. While the scatter is still flying the stars fade in but take no
    pointer events, so a moving target cannot be clicked by accident.
  */
  :global(html.motion) .sculpture:not([data-collapsed="true"])[data-map="closed"] .sculpture-map,
  .sculpture[data-motion="on"]:not([data-collapsed="true"])[data-map="closed"] .sculpture-map {
    visibility: hidden;
  }
  .sculpture[data-map="open"] .sculpture-map,
  .sculpture[data-map="opening"] .sculpture-map {
    opacity: 1;
  }
  .sculpture[data-map="opening"] .sculpture-map,
  .sculpture[data-map="opening"] .sculpture-star {
    pointer-events: none;
  }
  /* Without a canvas there is nothing to scatter, so the map is a plain list. */
  .sculpture[data-collapsed="true"] .sculpture-map,
  .sculpture[data-motion="off"] .sculpture-map {
    position: static;
    width: 100%;
    opacity: 1;
    pointer-events: auto;
  }
  .sculpture[data-collapsed="true"] .sculpture-map ul,
  .sculpture[data-motion="off"] .sculpture-map ul {
    position: static;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem 1.5rem;
    margin-top: 1.5rem;
  }
  .sculpture[data-collapsed="true"] .sculpture-map li,
  .sculpture[data-motion="off"] .sculpture-map li {
    position: static;
    transform: none;
  }

  /*
    The mark is the control. Closed, it is laid over the fitted letterform so the
    letterform itself is the target; open, it shrinks to a close affordance at the
    foot of the stage, which keeps focus on a real element instead of hiding the
    element the visitor just activated. Its hint sits below the mark rather than
    inside it, so no text is ever drawn over the letterform.
  */
  .sculpture-control {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 3;
    width: var(--mark-width, 0px);
    height: var(--mark-height, 0px);
    transform: translate(-50%, -50%);
    padding: 0;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--muted-ink);
    cursor: pointer;
  }
  .sculpture-control-hint {
    position: absolute;
    left: 50%;
    top: calc(100% + 0.5rem);
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }
  .sculpture[data-map="open"] .sculpture-control {
    top: auto;
    bottom: clamp(1.5rem, 6vh, 3rem);
    width: auto;
    height: auto;
    padding: 0.55rem 0.95rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 82%, transparent);
    color: var(--ink);
    transform: translate(-50%, 0);
  }
  .sculpture[data-map="open"] .sculpture-control-hint {
    position: static;
    transform: none;
  }
  .sculpture-control-glyph {
    font-size: 0.8rem;
    line-height: 1;
    color: var(--accent);
  }
  .sculpture-control-text {
    font: 500 0.68rem/1 var(--font-mono);
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  @media (prefers-reduced-motion: no-preference) {
    .sculpture[data-map="closed"] .sculpture-control-glyph {
      animation: star-breathe 2.6s ease-in-out infinite alternate;
    }
  }
  .sculpture-control:hover,
  .sculpture-control:focus-visible {
    color: var(--ink);
  }
  .sculpture-control:hover .sculpture-control-glyph,
  .sculpture-control:focus-visible .sculpture-control-glyph {
    color: var(--accent-ink);
    transform: scale(1.2);
  }
  @keyframes star-breathe {
    from {
      opacity: 0.6;
    }
    to {
      opacity: 1;
    }
  }

  /*
    The stage belongs to the component, not to the page-reveal module: a ready
    canvas keeps its own full-viewport layout even if that module is aborted and
    drops `html.motion`. Pre-paint `html.motion` only reserves the initial height
    so there is no jump before hydration.
  */
  :global(html.motion) .sculpture-sticky {
    position: relative;
    height: 100vh;
    height: 100dvh;
    padding-block: 0;
  }
  /*
    Collapsed means there is no canvas to draw — no JavaScript, reduced motion,
    or an unavailable 2D context. It must win over BOTH the pre-paint reserve and
    the ready-canvas rule, so a dead full-viewport spacer can never remain, even
    if the page-reveal module loaded and left `html.motion` on.
  */
  :global(html.motion) .sculpture[data-collapsed="true"] .sculpture-sticky,
  .sculpture[data-motion="on"][data-collapsed="true"] .sculpture-sticky {
    position: relative;
    height: auto;
    padding-block: clamp(3.5rem, 12vh, 7rem);
  }
</style>
