<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";
  import { FLAB_PATH, FLAB_FILL_RULE, FLAB_VIEWBOX } from "../lib/flabMark";

  /**
   * The opening sculpture. Its assembled target is sampled from the same filled
   * `flab` geometry that renders the header logo, so the gathered shape is the
   * real mark rather than an approximation.
   *
   * The opening occupies one viewport. Scroll, including the page's automatic
   * transition to Intro, breaks the mark into a depth-varied star cloud.
   * Reversing that transition reforms it. The field stays viewport-centred
   * during the transition and fades away before the lower sections take over.
   *
   * A second, sparse ambient population drifts on its own clock behind the mark
   * so the sky stays alive at rest without touching the mark's legibility.
   */

  const MAX_DPR = 2;
  const AMBIENT_DPR = 1.5;
  const DESKTOP_PARTICLES = 900;
  const MOBILE_PARTICLES = 420;
  const DESKTOP_AMBIENT = 90;
  const MOBILE_AMBIENT = 46;
  const SAMPLE_GRID = 4.4;
  /** Particles whose delay is below this never lag the gather at full assembly. */
  const GATHER_STAGGER = 0.5;

  const GLYPHS = ["+", "·", "•", "✳", "✦", "⋆", "✧", "﹡", "⋅", "✶", "*", "⁕"];
  const DENSE_GLYPHS = new Set(["•", "✳", "✦", "✧", "﹡", "✶", "⁕"]);

  // Maximum body rotation and radial flattening, used both to drive the render
  // and to bound the projection safely (see buildParticles).
  const MAX_ROT_Y = 0.3;
  const MAX_ROT_X = 0.18;
  const FLATTEN_MAX = 1.18;

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

  type Ambient = {
    ax: number;
    ay: number;
    amp: number;
    freqX: number;
    freqY: number;
    phaseX: number;
    phaseY: number;
    glyph: number;
    glyphRate: number;
    glyphPhase: number;
    size: number;
    tone: number;
    baseAlpha: number;
    alphaFreq: number;
    alphaPhase: number;
  };

  let scene: HTMLDivElement;
  let sticky: HTMLDivElement;
  let field: HTMLDivElement;
  let canvas: HTMLCanvasElement | undefined;
  let context: CanvasRenderingContext2D | undefined;
  let ambientCanvas: HTMLCanvasElement | undefined;
  let ambientContext: CanvasRenderingContext2D | undefined;

  let motionEnabled = $state(false);
  let collapsed = $state(false);
  let gather = $state(1);
  let hasCanvas = $state(false);
  // Observable contracts for tests: how many distinct glyphs the field uses and
  // the maximum particle depth, so glyph variety and 3D extent are verifiable
  // rather than inferred from pixels alone.
  let glyphVariety = $state(0);
  let depthExtent = $state(0);

  let particles: Particle[] = [];
  let ambient: Ambient[] = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let ambientDpr = 1;
  // Bound so the perspective divide stays positive for every rotated point: the
  // focal length always exceeds the deepest z, from a phone through 4K.
  let focalLength = $state(1000);
  let spreadZ = 420;
  // Observable contract for tests: the proven |z| bound the focal length clears.
  let depthBound = $state(0);
  let running = false;
  let visible = true;
  let clock = 0;
  let drawnGather = NaN;
  let fontFamily = "ui-monospace, monospace";
  // Glyph sizes follow the fitted mark so a small viewport does not fill the
  // letterform's counters with oversized stars.
  let assembledSize = 9;
  let scatteredSize = 10;

  function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
  }

  /** Deterministic pseudo-random in [0,1) from an index and salt. */
  function rand(index: number, salt: number) {
    let value = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }

  /**
   * Samples the filled mark into evenly spread points in artboard coordinates.
   * The jitter is seeded by grid cell, so resizing rebuilds the same field
   * instead of reshuffling it.
   */
  function sampleTargets(): { x: number; y: number }[] {
    const probe = document.createElement("canvas");
    probe.width = FLAB_VIEWBOX.width;
    probe.height = FLAB_VIEWBOX.height;
    const ctx = probe.getContext("2d");
    if (!ctx) return [];

    const path = new Path2D(FLAB_PATH);
    const columns = Math.ceil(FLAB_VIEWBOX.width / SAMPLE_GRID);

    const points: { x: number; y: number }[] = [];
    let row = 0;
    for (let y = 0; y < FLAB_VIEWBOX.height; y += SAMPLE_GRID) {
      let column = 0;
      for (let x = 0; x < FLAB_VIEWBOX.width; x += SAMPLE_GRID) {
        const cell = row * columns + column;
        const jx = x + (rand(cell, 101) - 0.5) * SAMPLE_GRID;
        const jy = y + (rand(cell, 102) - 0.5) * SAMPLE_GRID;
        if (ctx.isPointInPath(path, jx, jy, FLAB_FILL_RULE)) {
          points.push({ x: jx, y: jy });
        }
        column += 1;
      }
      row += 1;
    }
    return points;
  }

  function buildParticles() {
    const targets = sampleTargets();
    if (!targets.length || !width || !height) return;

    const count = width < 760 ? MOBILE_PARTICLES : DESKTOP_PARTICLES;
    const centreX = width / 2;
    const centreY = height / 2;

    // Modest assembled scale: ~44% of the viewport width on desktop, wider on
    // phones so the letterform's counters stay legible. The fitted mark is also
    // capped by width (20rem mobile / 40rem desktop, matching the static SVG
    // fallback) and by 52% of the viewport height, so the fixed-size glyphs
    // never fragment the letterform and the pre-paint SVG matches the canvas.
    const markRatio = width < 760 ? 0.66 : 0.44;
    const markCap = (width < 760 ? 20 : 40) * 16;
    const fit = Math.min(
      (width * markRatio) / FLAB_VIEWBOX.width,
      (height * 0.52) / FLAB_VIEWBOX.height,
      markCap / FLAB_VIEWBOX.width,
    );
    const markW = FLAB_VIEWBOX.width * fit;
    const markH = FLAB_VIEWBOX.height * fit;
    const markLeft = centreX - markW / 2;
    const markTop = centreY - markH / 2;
    const markRadius = Math.hypot(markW, markH) / 2;

    // The cloud is far wider than the mark in every direction, so no part of the
    // assembled silhouette can remain legible while scattered.
    const spreadX = Math.max(width * 0.95, markRadius * 2.9);
    const spreadY = Math.max(height * 0.95, markRadius * 2.7);
    spreadZ = Math.max(300, markRadius * 2);

    // Rotation mixes x and y into z, so spreadZ alone does not bound the depth.
    // For the render's maximum angles, |z2| <= maxY*sin(MAX_ROT_X) +
    // maxX*sin(MAX_ROT_Y) + spreadZ; keeping the focal length above that bound
    // keeps every denominator (focalLength + z2) strictly positive — including
    // very wide, short viewports where x dwarfs z.
    const maxX = spreadX;
    const maxY = spreadY * FLATTEN_MAX;
    depthBound =
      maxY * Math.sin(MAX_ROT_X) + maxX * Math.sin(MAX_ROT_Y) + spreadZ;
    focalLength = Math.max(900, depthBound * 1.08);

    assembledSize = Math.min(Math.max(11 * fit, 2.4), 11);
    scatteredSize = Math.min(Math.max(20 * fit, 6), 15);

    const next: Particle[] = [];
    let deepest = 0;
    for (let index = 0; index < count; index += 1) {
      const target = targets[Math.floor((index / count) * targets.length)];

      // A natural 3D cloud: mass falls off from the centre, so the sky keeps a
      // populated middle instead of a hollow ring, and the depth term breaks up
      // any flat disc silhouette.
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
        delay: rand(index, 5) * GATHER_STAGGER,
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

    buildAmbient();
  }

  /** Sparse stars that ring the mark and drift on their own clock. */
  function buildAmbient() {
    const count = width < 760 ? MOBILE_AMBIENT : DESKTOP_AMBIENT;
    const reach = Math.min(width, height) * 0.72;
    // On very large stages a slight optical increase keeps the brighter subset
    // visible without inflating the soft dots into noise. Ordinary desktop and
    // mobile stages stay at 1.
    const ambientScale = Math.min(
      1.7,
      Math.max(1, Math.min(width, height) / 1440),
    );
    const next: Ambient[] = [];
    for (let index = 0; index < count; index += 1) {
      const angle = rand(index, 21) * Math.PI * 2;
      // Bias the population outward so most stars sit around the silhouette
      // rather than inside it, keeping the mark legible while the sky reads as
      // a surrounding field.
      const radius = 0.4 + rand(index, 22) * 0.6;
      // A modest subset carries visibly brighter, larger stars so the sky has
      // real presence; the rest stay soft and small.
      const bright = rand(index, 36) > 0.68;
      next.push({
        ax: width / 2 + Math.cos(angle) * radius * reach,
        ay: height / 2 + Math.sin(angle) * radius * reach * 0.92,
        amp: 6 + rand(index, 23) * 16,
        freqX: 0.05 + rand(index, 24) * 0.13,
        freqY: 0.05 + rand(index, 25) * 0.13,
        phaseX: rand(index, 26) * Math.PI * 2,
        phaseY: rand(index, 27) * Math.PI * 2,
        glyph: Math.floor(rand(index, 28) * GLYPHS.length),
        glyphRate: 0.12 + rand(index, 29) * 0.4,
        glyphPhase: rand(index, 30) * 12,
        size: bright
          ? (9 + rand(index, 31) * 6) * ambientScale
          : 4.5 + rand(index, 31) * 4.5,
        tone: rand(index, 32),
        baseAlpha: bright
          ? 0.42 + rand(index, 33) * 0.28
          : 0.14 + rand(index, 33) * 0.16,
        alphaFreq: 0.08 + rand(index, 34) * 0.22,
        alphaPhase: rand(index, 35) * Math.PI * 2,
      });
    }
    ambient = next;
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

    // focalLength clears the proven depth bound, so the denominator is always
    // positive; a null result here would mean the bound is wrong, so the caller
    // skips the particle rather than drawing inverted geometry. The cap is an
    // aesthetic limit on the rare near-camera star, not a safety mechanism.
    const denominator = focalLength + z2;
    if (denominator <= 1) return undefined;
    const scale = Math.min(2.2, focalLength / denominator);
    return { x: cx + x1 * scale, y: cy + y1 * scale, scale, depth: z2 };
  }

  function renderMain() {
    if (!context || !canvas) return;

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

    for (const particle of particles) {
      const local = clamp01((gather - particle.delay) / (1 - GATHER_STAGGER));
      const eased = easeOutCubic(local);

      const x = particle.sx + (particle.tx - particle.sx) * eased;
      const y = particle.sy + (particle.ty - particle.sy) * eased;
      const z = particle.sz + (particle.tz - particle.sz) * eased;

      const point = project(x, y, z, rotY, rotX, cx, cy);
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

      const violet = particle.tone > 0.84;
      context.fillStyle = violet
        ? `rgba(167, 139, 250, ${alpha.toFixed(3)})`
        : `rgba(236, 232, 244, ${alpha.toFixed(3)})`;

      context.font = `${dense ? 400 : 300} ${size.toFixed(1)}px ${fontFamily}`;
      context.fillText(glyph, point.x, point.y);
    }
    drawnGather = gather;
  }

  function renderAmbient(seconds: number) {
    if (!ambientContext || !ambientCanvas) return;

    ambientContext.setTransform(ambientDpr, 0, 0, ambientDpr, 0, 0);
    ambientContext.clearRect(0, 0, width, height);
    ambientContext.textAlign = "center";
    ambientContext.textBaseline = "middle";

    for (const star of ambient) {
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

      const violet = star.tone > 0.8;
      ambientContext.fillStyle = violet
        ? `rgba(167, 139, 250, ${alpha.toFixed(3)})`
        : `rgba(236, 232, 244, ${alpha.toFixed(3)})`;
      const dense = DENSE_GLYPHS.has(glyph);
      ambientContext.font = `${dense ? 400 : 300} ${star.size.toFixed(1)}px ${fontFamily}`;
      ambientContext.fillText(glyph, x, y);
    }
  }

  function tick() {
    // GSAP updates the page position before this ticker listener. Read and
    // paint that pose once, without waiting for a later native scroll event.
    clock = performance.now() / 1000;
    computeGather();
    // Scroll/visibility observers can update the pose before this tick. Compare
    // with the actual buffer so an instant return still draws the endpoint.
    if (drawnGather !== gather || (gather > 0 && gather < 1)) renderMain();
    if (visible) renderAmbient(clock);
    if (!motionEnabled || !visible || document.hidden) stop();
  }

  function stop() {
    gsap.ticker.remove(tick);
    running = false;
  }

  function start() {
    if (running || !motionEnabled || !visible || document.hidden) return;
    running = true;
    gsap.ticker.add(tick);
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
    buildParticles();
    computeGather();
    renderAmbient(clock);
    renderMain();
  }

  /**
   * Native scroll is the only input: the mark is fully gathered at the top of
   * the scene and fully dispersed at Intro. Reading
   * the live geometry keeps direct hashes, resizes, quick reversals and
   * back-to-top in sync.
   */
  function computeGather() {
    if (!scene || !sticky) return;
    const total = scene.offsetHeight;
    const box = scene.getBoundingClientRect();
    visible = box.bottom > 0 && box.top < window.innerHeight;
    const scrolled = -box.top;
    const progress = total > 4 ? clamp01(scrolled / total) : 0;
    const eased = progress * progress * (3 - 2 * progress);
    const next = 1 - eased;
    if (next === gather || (next > 0 && next < 1 && Math.abs(next - gather) <= 0.0005)) return false;
    gather = next;
    return true;
  }

  function removeCanvases() {
    canvas?.remove();
    ambientCanvas?.remove();
    canvas = undefined;
    context = undefined;
    ambientCanvas = undefined;
    ambientContext = undefined;
    hasCanvas = false;
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
      hasCanvas = true;
    }

    resize();
    // If the mark could not be sampled at all, the stage would be blank; fall
    // back to the SVG mark and collapse the scene instead.
    if (!particles.length) {
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
    stop();
    removeCanvases();
    gather = 1;
  }

  onMount(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    fontFamily =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-mono")
        .trim() || fontFamily;

    function syncPreference() {
      if (motionQuery.matches) disableMotion();
      else enableMotion();
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
        if (visible) {
          computeGather();
          if (!running) renderMain();
          start();
        }
      },
      { threshold: 0.02 },
    );
    intersectionObserver.observe(scene);

    function handleScroll() {
      if (!motionEnabled || document.hidden || running) return;
      const changed = computeGather();
      // Offscreen endpoints still need truthful state; visible animation is
      // painted only by the post-scroll ticker, not twice in the same frame.
      if (changed && !visible) renderMain();
      start();
    }

    function handleVisibility() {
      if (document.hidden) {
        stop();
      } else {
        computeGather();
        start();
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("hashchange", handleScroll);
    window.addEventListener("after-hours-flight", handleScroll);
    document.addEventListener("visibilitychange", handleVisibility);
    motionQuery.addEventListener("change", syncPreference);
    syncPreference();

    return () => {
      motionQuery.removeEventListener("change", syncPreference);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("hashchange", handleScroll);
      window.removeEventListener("after-hours-flight", handleScroll);
      document.removeEventListener("visibilitychange", handleVisibility);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      stop();
      removeCanvases();
    };
  });
</script>

<div
  class="sculpture"
  data-motion={motionEnabled ? "on" : "off"}
  data-collapsed={collapsed ? "true" : "false"}
  data-gather={gather.toFixed(3)}
  data-focal={Math.round(focalLength)}
  data-depth-bound={Math.round(depthBound)}
  data-glyph-variety={glyphVariety}
  data-depth-extent={Math.round(depthExtent)}
>
  <div class="sculpture-scene" bind:this={scene}>
    <div class="sculpture-sticky" bind:this={sticky}>
      <div class="sculpture-field" style:opacity={motionEnabled ? gather : 1} bind:this={field}>
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
    height: 100vh;
    height: 100dvh;
  }
  /* Full-page composition is stable in motion, static and no-JS modes. */
  .sculpture-sticky {
    position: relative;
    display: grid;
    place-items: center;
    height: 100%;
  }
  .sculpture-field {
    position: relative;
    width: 100%;
    height: 100%;
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
    width: min(66vw, 20rem, calc(52dvh * 402 / 272));
    height: auto;
    display: block;
  }
  @media (min-width: 760px) {
    .flab-mark svg {
      width: min(44vw, 40rem, calc(52dvh * 402 / 272));
    }
  }
  /* Once the canvas owns the field, the static mark steps aside. */
  .sculpture[data-motion="on"]:not([data-collapsed="true"]) .sculpture-field {
    position: fixed;
    inset: 0;
    height: 100vh;
    height: 100dvh;
    pointer-events: none;
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

</style>
