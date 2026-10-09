<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";

  // One persistent DOM sky, mounted directly inside body. The opening canvas
  // owns the assembled mark; this layer only takes over its dispersed sky.
  const GLYPHS = ["+", "·", "•", "✳", "✦", "⋆", "✧", "﹡", "⋅", "✶", "*", "⁕"];
  const INK = "#ece8f4";
  const VIOLET = "#a78bfa";
  const PLUM = "#1b1430";
  const FLIGHT_RATE = 14;

  type Star = {
    node: HTMLSpanElement;
    glyphNode: HTMLSpanElement;
    drift: Animation;
    twinkle: Animation;
    glyph: number;
    period: number;
    peak: number;
    ink: string;
    plum: boolean;
  };

  let host: HTMLDivElement;

  function rand(index: number, salt: number) {
    let value = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }

  function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
  }

  function smooth(value: number) {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  onMount(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stars: Star[] = [];
    let ranges: Range[] = [];
    let symbols: Element[] = [];
    let paused = document.hidden || preference.matches;
    let destroyed = false;
    // Hydration can finish after a gesture has already started.
    let flight = document.documentElement.dataset.flight === "true";
    let direction = document.documentElement.dataset.flightDirection === "-1" ? -1 : 1;
    let rate = 1;
    let pulseUntil = 0;
    let previousY = window.scrollY;
    let previousFrame = 0;
    let rateFrame = 0;
    let paintFrame = 0;
    let glyphTimer = 0;
    let quietTimer = 0;
    let ticks = 0;

    function addStar(index: number) {
      const node = document.createElement("span");
      const glyphNode = document.createElement("span");
      node.className = "star";
      glyphNode.className = "star-glyph";
      const bright = rand(index, 36) > 0.7;
      const glyph = Math.floor(rand(index, 28) * GLYPHS.length);
      const size = bright ? 10 + rand(index, 31) * 9 : 4 + rand(index, 31) * 5;
      const peak = bright ? 0.46 + rand(index, 33) * 0.3 : 0.16 + rand(index, 33) * 0.19;
      const ink = rand(index, 32) > 0.8 ? VIOLET : INK;
      glyphNode.textContent = GLYPHS[glyph];
      node.style.left = `${(rand(index, 21) * 100).toFixed(3)}%`;
      node.style.top = `${(rand(index, 22) * 100).toFixed(3)}%`;
      node.style.fontSize = `${size.toFixed(1)}px`;
      node.style.color = ink;
      // The outer opacity is the text-quiet envelope; the inner opacity is a
      // compositor twinkle. Their product can never exceed the envelope cap.
      node.style.opacity = "0";
      node.append(glyphNode);
      host.append(node);

      const duration = 50000 + rand(index, 24) * 45000;
      const amplitude = 18 + rand(index, 23) * 24;
      const phase = rand(index, 26) * Math.PI * 2;
      const keyframes = Array.from({ length: 33 }, (_, step) => {
        const angle = (step / 32) * Math.PI * 2 + phase;
        return {
          transform: `translate(${(Math.sin(angle) * amplitude).toFixed(3)}px, ${(Math.cos(angle) * amplitude * 0.8).toFixed(3)}px)`,
          offset: step / 32,
        };
      });
      const drift = node.animate(keyframes, { duration, iterations: Infinity });
      const twinkle = glyphNode.animate(
        [{ opacity: 0.4 }, { opacity: 1 }, { opacity: 0.4 }],
        { duration: 18000 + rand(index, 34) * 26000, iterations: Infinity, easing: "ease-in-out" },
      );
      // Pause immediately, including hydration in an initially hidden tab.
      // A large whole-cycle offset leaves room for signed reverse playback;
      // only the fractional phase is visible. Neither clock is ever rebuilt
      // for scrolling, disclosure changes or preference changes.
      drift.pause();
      twinkle.pause();
      drift.currentTime = duration * (10000 + rand(index, 27));
      twinkle.currentTime = rand(index, 35) * 40000;
      drift.updatePlaybackRate(rate);
      if (!paused) {
        drift.play();
        twinkle.play();
      }
      stars.push({ node, glyphNode, drift, twinkle, glyph, period: 8 + Math.floor(rand(index, 29) * 23), peak, ink, plum: false });
    }

    function resize() {
      if (destroyed) return;
      const width = host.clientWidth;
      const area = width * host.clientHeight;
      const count = width < 760
        ? Math.max(65, Math.min(100, Math.round(area / 4200)))
        : Math.max(140, Math.min(240, Math.round(area / 6500)));
      // Only viewport resizing changes population. Long sections and opening
      // Profile records never recreate or redistribute the existing stars.
      while (stars.length < count) addStar(stars.length);
      while (stars.length > count) {
        const star = stars.pop()!;
        star.drift.cancel();
        star.twinkle.cancel();
        star.node.remove();
      }
      host.dataset.count = String(count);
      schedulePaint();
    }

    function collectText() {
      if (destroyed) return;
      ranges = [];
      // Text-node line boxes cover every kind of copy, including ledger detail,
      // footer signatures and navbar labels, without masking whole columns.
      for (const scope of document.querySelectorAll(".site-header, .section-content, .site-footer")) {
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        let text: Node | null;
        while ((text = walker.nextNode())) {
          if (!text.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(text);
          ranges.push(range);
        }
      }
      symbols = [...document.querySelectorAll(".site-header svg, .contact-icon svg")];
      schedulePaint();
    }

    function paint() {
      if (destroyed || document.hidden) return;
      const height = host.clientHeight;
      const width = host.clientWidth;
      const opening = document.querySelector(".sculpture-scene") ?? document.querySelector("#identity");
      const openingBox = opening?.getBoundingClientRect();
      // The same native, one-viewport smoothstep as FlabSculpture's gather.
      // Reduced motion keeps a quiet frozen sky behind the static opening mark.
      const opacity = preference.matches || !openingBox
        ? 1
        : smooth(-openingBox.top / Math.max(1, openingBox.height));
      const contact = document.querySelector("#contact-path")?.getBoundingClientRect();
      const boxes: DOMRect[] = [];
      const inView = (box: DOMRect) => box.width > 0 && box.height > 0 && box.bottom > -80 && box.top < height + 80 && box.right > -80 && box.left < width + 80;
      // Finish all geometry reads before any style writes. Ranges account for
      // wrapping, sticky Work copy, reveals and newly opened Profile rows.
      for (const range of ranges) {
        for (const box of range.getClientRects()) if (inView(box)) boxes.push(box);
      }
      for (const symbol of symbols) {
        const box = symbol.getBoundingClientRect();
        if (inView(box)) boxes.push(box);
      }
      const positions = stars.map((star) => star.node.getBoundingClientRect());
      const skyAlpha = String(Number(opacity.toFixed(4)));
      if (host.style.opacity !== skyAlpha) host.style.opacity = skyAlpha;
      for (let index = 0; index < stars.length; index += 1) {
        const star = stars[index];
        const position = positions[index];
        const plum = !!contact && position.bottom >= contact.top && position.top <= contact.bottom;
        const peak = preference.matches ? Math.min(star.peak, 0.24) : star.peak;
        const cap = plum ? 0.18 : 0.14;
        let distance = Infinity;
        for (const box of boxes) {
          const dx = Math.max(box.left - position.right, position.left - box.right, 0);
          const dy = Math.max(box.top - position.bottom, position.top - box.bottom, 0);
          distance = Math.min(distance, Math.hypot(dx, dy));
          if (distance <= 18) break;
        }
        // An 18px quiet core protects the entire glyph between ambient samples;
        // a 48px rounded smoothstep feather avoids visible rectangular masks.
        const quiet = smooth((distance - 18) / 48);
        const alpha = String(Number((Math.min(peak, cap) + (peak - Math.min(peak, cap)) * quiet).toFixed(4)));
        if (star.node.style.opacity !== alpha) star.node.style.opacity = alpha;
        // No colour tween: white must never linger over the violet Contact band.
        if (star.plum !== plum) {
          star.plum = plum;
          star.node.style.color = plum ? PLUM : star.ink;
        }
      }
    }

    function schedulePaint() {
      if (paintFrame || document.hidden || destroyed || (flight && !paused)) return;
      paintFrame = requestAnimationFrame(() => {
        paintFrame = 0;
        paint();
      });
    }

    function updateRate(now: number) {
      rateFrame = 0;
      if (paused || destroyed) return;
      // Ease by elapsed time even on slow rendering pipelines. startRate()
      // resets the clock after a visibility/preference pause.
      const delta = Math.max(0, now - previousFrame);
      previousFrame = now;
      const target = direction * (flight ? FLIGHT_RATE : now < pulseUntil ? 4 : 1);
      const easing = 1 - Math.exp(-delta / (flight ? 100 : 340));
      const previousRate = rate;
      rate += (target - rate) * easing;
      if (Math.abs(target - rate) < 0.015) rate = target;
      if (rate !== previousRate) for (const star of stars) star.drift.updatePlaybackRate(rate);
      host.dataset.rate = rate.toFixed(3);
      // Flight geometry changes quickly: refresh the feather every rendered
      // frame, while resting drift stays entirely on the compositor.
      schedulePaint();
      if (flight || now < pulseUntil || rate !== target) rateFrame = requestAnimationFrame(updateRate);
    }

    function startRate() {
      if (rateFrame || paused || destroyed) return;
      previousFrame = performance.now();
      rateFrame = requestAnimationFrame(updateRate);
    }

    function syncFlight() {
      gsap.ticker.remove(paint);
      if (flight && !paused) {
        if (rateFrame) cancelAnimationFrame(rateFrame);
        if (paintFrame) cancelAnimationFrame(paintFrame);
        rateFrame = paintFrame = 0;
        // Commit native acceleration before the tween can move the page. Keep
        // the phase continuous; only the return to idle needs rate relaxation.
        rate = direction * FLIGHT_RATE;
        for (const star of stars) {
          // updatePlaybackRate waits for a compositor-ready task, which may
          // arrive after the first slide frame. Preserve the current phase
          // explicitly while committing the rate synchronously instead.
          const time = star.drift.currentTime;
          star.drift.playbackRate = rate;
          star.drift.currentTime = time;
        }
        host.dataset.rate = rate.toFixed(3);
        gsap.ticker.add(paint);
      } else {
        startRate();
      }
      paint();
    }

    function handleFlight(event: Event) {
      const detail = (event as CustomEvent<{ active: boolean; direction: number }>).detail;
      if (!detail || typeof detail.active !== "boolean") return;
      flight = detail.active;
      if (Number.isFinite(detail.direction) && detail.direction !== 0) direction = Math.sign(detail.direction);
      pulseUntil = 0;
      host.dataset.flight = String(flight);
      syncFlight();
    }

    function handleScroll() {
      const y = window.scrollY;
      if (!paused && !flight && Math.abs(y - previousY) > 1) {
        direction = Math.sign(y - previousY);
        pulseUntil = performance.now() + 180;
        startRate();
      }
      previousY = y;
      schedulePaint();
    }

    function syncMotion() {
      paused = document.hidden || preference.matches;
      host.classList.toggle("paused", paused);
      host.dataset.motion = paused ? "off" : "on";
      for (const star of stars) {
        if (paused) {
          star.drift.pause();
          star.twinkle.pause();
        } else {
          star.drift.play();
          star.twinkle.play();
        }
      }
      window.clearInterval(glyphTimer);
      window.clearInterval(quietTimer);
      glyphTimer = quietTimer = 0;
      if (rateFrame) cancelAnimationFrame(rateFrame);
      rateFrame = 0;
      if (paintFrame) cancelAnimationFrame(paintFrame);
      paintFrame = 0;
      pulseUntil = 0;
      previousY = window.scrollY;
      if (!paused) {
        glyphTimer = window.setInterval(() => {
          ticks += 1;
          for (const star of stars) {
            if (ticks % star.period !== 0) continue;
            star.glyph = (star.glyph + 1) % GLYPHS.length;
            star.glyphNode.textContent = GLYPHS[star.glyph];
          }
        }, 240);
        quietTimer = window.setInterval(schedulePaint, 100);
      }
      syncFlight();
      schedulePaint();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const contentObserver = new ResizeObserver(schedulePaint);
    const mutationObserver = new MutationObserver(collectText);
    for (const scope of document.querySelectorAll("main, .site-header")) {
      contentObserver.observe(scope);
      mutationObserver.observe(scope, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    }
    window.addEventListener("after-hours-flight", handleFlight);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("hashchange", schedulePaint);
    document.addEventListener("toggle", schedulePaint, true);
    document.addEventListener("visibilitychange", syncMotion);
    preference.addEventListener("change", syncMotion);
    resize();
    collectText();
    syncMotion();
    host.dataset.flight = String(flight);
    host.dataset.rate = rate.toFixed(3);
    host.dataset.glyphVariety = String(GLYPHS.length);

    return () => {
      destroyed = true;
      gsap.ticker.remove(paint);
      resizeObserver.disconnect();
      contentObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("after-hours-flight", handleFlight);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("hashchange", schedulePaint);
      document.removeEventListener("toggle", schedulePaint, true);
      document.removeEventListener("visibilitychange", syncMotion);
      preference.removeEventListener("change", syncMotion);
      if (rateFrame) cancelAnimationFrame(rateFrame);
      if (paintFrame) cancelAnimationFrame(paintFrame);
      window.clearInterval(glyphTimer);
      window.clearInterval(quietTimer);
      for (const star of stars) {
        star.drift.cancel();
        star.twinkle.cancel();
        star.node.remove();
      }
      ranges = [];
      symbols = [];
    };
  });
</script>

<div class="starfield" aria-hidden="true" bind:this={host}></div>

<style>
  .starfield {
    position: fixed;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    pointer-events: none;
    opacity: 0;
    contain: layout paint;
    font-family: var(--font-mono, ui-monospace, monospace);
  }
  /* Imperatively created spans do not receive Svelte's scoped class. */
  :global(.starfield .star) {
    position: absolute;
    width: 1em;
    height: 1em;
    line-height: 1;
    text-align: center;
    will-change: transform;
  }
  :global(.starfield .star-glyph) {
    display: block;
    will-change: opacity;
  }
</style>
