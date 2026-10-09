import {
  TIMELINE,
  measureLayout,
  presentationOffset,
  progressForRead,
  gatherAt,
  activeSceneIndex,
  sceneScrollPosition,
  skyState,
  clamp01,
  type Layout,
} from "./timeline";

/**
 * Global timeline controller.
 *
 * One progress drives everything: progress = scrollY / (scrollHeight - innerHeight),
 * 0 at the Opening and 1 at the Contact bottom. The journey supplies a native
 * scroll budget; the sticky stage is pinned and this controller scrubs the scene
 * stack from that single progress. It never snaps, completes a gesture or traps
 * wheel/touch/keyboard input: stopping leaves the exact partial position.
 *
 * Pinning is opt-in: the layout is activated only after setup succeeds and only
 * without a reduced-motion preference, so no-JS, an aborted module or reduced
 * motion always expose the whole ordinary document.
 */
export function setupSectionScroll(onAfterRender?: (activeIndex: number) => void) {
  const journey = document.querySelector<HTMLElement>("[data-journey]");
  const contactSurface = document.querySelector<HTMLElement>(".contact-surface");
  const header = document.querySelector<HTMLElement>(".site-header");
  const scenes = TIMELINE.map((scene) =>
    document.querySelector<HTMLElement>(`[data-scene="${scene.id}"]`),
  );
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const lastScene = TIMELINE.length - 1;
  // Idle drift magnitude and how strongly scroll speed adds to it.
  const IDLE_RATE = 1;
  const VELOCITY_SCALE = 0.0003;
  const MAX_RATE = 8;

  let layout: Layout | undefined;
  let active = false;
  let velocity = 0;
  let velocityTimer = 0;
  let previousY = window.scrollY;
  let previousT = performance.now();
  let frame = 0;
  // One shared motion-time source. The signed scroll speed sets the rate; the
  // clock integrates the elapsed OLD rate at every rate change and at every
  // paint, so a scroll pulse that starts and ends between slow frames is never
  // lost, and reverse runs the phase backward.
  let motionClock = 0;
  let rate = IDLE_RATE;
  let lastLoopAt = 0;
  let loopFrame = 0;
  let lastOffset = NaN;
  let lastProgress = 0;

  function measure() {
    if (!journey) return;
    // A layout change is a correction, not idle motion. Capture the current
    // scene, its content read offset and its hold/transition fraction from the
    // OLD layout, then map that exact pose into the new one, so a resize or a
    // disclosure expansion keeps the same chapter and read position instead of
    // jumping (or moving a focused summary).
    let pose:
      | { index: number; readOffset: number; holdFraction: number; transition: number }
      | undefined;
    if (layout && layout.scroll > 0) {
      const p = clamp01(window.scrollY / layout.scroll);
      const index = activeSceneIndex(p);
      const scene = TIMELINE[index];
      const offset = presentationOffset(p, layout);
      const top = layout.tops[index] ?? 0;
      const overflow = Math.max(0, (layout.heights[index] ?? 0) - layout.viewport);
      const stableScroll = (scene.outStart - scene.start) * layout.scroll;
      const holdScroll = Math.max(0, stableScroll - overflow);
      const inTransition =
        scene.outEnd > scene.outStart && p >= scene.outStart && p < scene.outEnd;
      pose = {
        index,
        readOffset: Math.max(0, offset - top),
        holdFraction:
          holdScroll > 0
            ? clamp01(((p - scene.start) * layout.scroll) / holdScroll)
            : 0,
        transition: inTransition
          ? (p - scene.outStart) / (scene.outEnd - scene.outStart)
          : -1,
      };
    }
    const viewport = window.innerHeight;
    const heights = scenes.map((scene) =>
      scene ? scene.getBoundingClientRect().height : viewport,
    );
    layout = measureLayout(heights, viewport);
    journey.style.height = `${layout.scroll + viewport}px`;
    // A relayout, disclosure expansion or resize invalidates cached text bounds.
    skyState.layoutVersion += 1;
    if (pose) {
      const scene = TIMELINE[pose.index];
      const next =
        pose.transition >= 0
          ? scene.outStart + pose.transition * (scene.outEnd - scene.outStart)
          : progressForRead(
              pose.index,
              pose.readOffset,
              layout,
              pose.holdFraction,
            );
      window.scrollTo({ top: next * layout.scroll, behavior: "instant" });
    }
  }

  function syncOrdinaryHeader() {
    if (!header) return;
    const contact = document.querySelector<HTMLElement>("#contact-path");
    if (!contact) return;
    const box = header.getBoundingClientRect();
    const centre = box.top + box.height / 2;
    const band = contact.getBoundingClientRect();
    header.dataset.contact = String(band.top <= centre && band.bottom > centre);
  }

  function contactOpacity(p: number) {
    // The violet Contact surface scrubs in with the entering screen, driven by
    // the same global progress as the scene transforms, so it never appears on
    // an independent timer after native input stops.
    const entering = TIMELINE[lastScene - 1];
    if (p <= entering.outStart) return 0;
    if (p >= entering.outEnd) return 1;
    const local = (p - entering.outStart) / (entering.outEnd - entering.outStart);
    return local * local * (3 - 2 * local);
  }

  function publish() {
    skyState.motionClock = motionClock;
    skyState.rate = rate;
  }

  function integrateTo(now: number) {
    // Never integrate while hidden: a throttled timer or a resume would
    // otherwise fold the hidden interval into the phase.
    if (document.hidden || lastLoopAt === 0) {
      lastLoopAt = now;
      return;
    }
    motionClock += ((now - lastLoopAt) / 1000) * rate;
    lastLoopAt = now;
  }

  function setRate(next: number) {
    if (document.hidden) {
      rate = next;
      skyState.rate = rate;
      return;
    }
    integrateTo(performance.now());
    rate = next;
    skyState.rate = rate;
  }

  function rateForVelocity(v: number) {
    // Preserve the signed direction even at slow speeds, and keep an explicit
    // positive idle magnitude so the cloud always drifts gently at rest.
    const magnitude = Math.min(MAX_RATE, IDLE_RATE + Math.abs(v) * VELOCITY_SCALE);
    return (v < 0 ? -1 : 1) * magnitude;
  }

  function render() {
    frame = 0;
    if (!layout || !active) return;
    const p = layout.scroll > 0 ? clamp01(window.scrollY / layout.scroll) : 0;
    lastProgress = p;
    const offset = presentationOffset(p, layout);
    if (offset !== lastOffset) {
      lastOffset = offset;
      for (let index = 0; index < scenes.length; index += 1) {
        const scene = scenes[index];
        if (!scene) continue;
        const top = layout.tops[index] ?? 0;
        scene.style.transform = `translate3d(0, ${(top - offset).toFixed(2)}px, 0)`;
      }
      const contact = contactOpacity(p);
      if (contactSurface) {
        contactSurface.style.opacity = contact.toFixed(3);
        contactSurface.dataset.visible = String(contact > 0);
      }
      if (header) header.dataset.contact = String(contact > 0.5);
      skyState.gather = preference.matches ? 1 : gatherAt(p);
      skyState.contact = contact;
      skyState.active = activeSceneIndex(p);
      skyState.offset = offset;
      // Foreground clipping and focus exposure depend on the transforms just
      // applied, so they run here rather than from a prior native scroll callback.
      onAfterRender?.(skyState.active);
    }
  }

  function requestRender() {
    if (frame) return;
    frame = requestAnimationFrame(render);
  }

  // The cloud animates continuously, so one shared loop integrates the motion
  // clock and keeps the published state fresh, including through idle holds.
  function loop(now: number) {
    loopFrame = requestAnimationFrame(loop);
    integrateTo(now);
    publish();
    if (skyState.offset !== lastOffset) requestRender();
  }

  function startLoop() {
    if (loopFrame || document.hidden) return;
    lastLoopAt = 0;
    loopFrame = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (loopFrame) cancelAnimationFrame(loopFrame);
    loopFrame = 0;
  }

  function decayVelocity() {
    velocity = 0;
    skyState.velocity = 0;
    setRate(IDLE_RATE);
  }

  function scroll() {
    if (!active) {
      // The ordinary/reduced document has no pinned transforms and no
      // presentation scroll, but the fixed navbar still themes from the real
      // Contact geometry as the page scrolls. Rebase the gesture clock so
      // reactivating the pinned presentation never sees a stale interval.
      previousY = window.scrollY;
      previousT = performance.now();
      syncOrdinaryHeader();
      return;
    }
    const y = window.scrollY;
    const now = performance.now();
    // Clamp the interval: the first scroll after an idle gap would otherwise
    // divide a real gesture by a multi-second dt and underestimate its speed.
    const dt = Math.min(100, Math.max(1, now - previousT));
    velocity = ((y - previousY) / dt) * 1000;
    previousY = y;
    previousT = now;
    // Signed scroll speed: the sky follows every scroll, including holds and
    // reading, and accelerates with faster scrolling. Idle drift resumes after.
    skyState.velocity = preference.matches ? 0 : velocity;
    setRate(preference.matches ? 0 : rateForVelocity(velocity));
    window.clearTimeout(velocityTimer);
    velocityTimer = window.setTimeout(decayVelocity, 140);
    requestRender();
  }

  function scrollToScene(id: string) {
    // Only the pinned presentation maps a scene to a global progress; the
    // ordinary document uses native fragment scrolling.
    if (!active || !layout) return;
    const index = TIMELINE.findIndex((scene) => scene.id === id);
    if (index < 0) return;
    window.scrollTo({
      top: sceneScrollPosition(index, layout),
      behavior: "instant",
    });
  }

  function hash() {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) scrollToScene(id);
  }

  // In-page anchors navigate explicitly to their scene's settled position, so a
  // repeated same-hash click still lands correctly instead of relying on native
  // fragment scrolling inside the clipped stage.
  function anchorClick(event: MouseEvent) {
    if (!active) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const id = decodeURIComponent(link.hash.slice(1));
    if (!id || !TIMELINE.some((scene) => scene.id === id)) return;
    event.preventDefault();
    scrollToScene(id);
    // Reflect the destination in the URL without a second native jump.
    history.replaceState(null, "", `#${id}`);
  }

  function focusIn(event: FocusEvent) {
    const node = event.target;
    if (!(node instanceof Element)) return;
    const scene = node.closest<HTMLElement>("[data-scene]");
    if (!scene || !layout || !active) return;
    const index = TIMELINE.findIndex((s) => s.id === scene.dataset.scene);
    if (index < 0) return;
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    const box = node.getBoundingClientRect();
    // Keep an already fully visible control stationary.
    if (box.top >= headerBottom && box.bottom <= window.innerHeight && box.bottom > 0)
      return;
    // Map the target to its read offset WITHIN its scene, then to the timeline's
    // own progress, so offscreen Tab lands in the right stable/read interval.
    const sceneTop = scene.getBoundingClientRect().top;
    const localTop = box.top - sceneTop;
    const sceneHeight = layout.heights[index] ?? 0;
    const ring = 8;
    const desiredRead = Math.min(
      Math.max(0, localTop - headerBottom - ring),
      Math.max(0, sceneHeight - window.innerHeight),
    );
    const next = progressForRead(index, desiredRead, layout);
    window.scrollTo({ top: next * layout.scroll, behavior: "instant" });
  }

  function setActive(next: boolean) {
    if (next === active) return;
    // Preserve the reader's logical position across a layout swap (pinned <->
    // ordinary), so toggling reduced motion never jumps to another chapter.
    const preserved = lastProgress;
    active = next;
    document.documentElement.dataset.pinned = String(active);
    if (journey) journey.dataset.active = String(active);
    if (!active) {
      stopLoop();
      for (const scene of scenes) if (scene) scene.style.transform = "";
      // Clearing the presentation styles invalidates the render memo, so the
      // next activation reapplies transforms instead of skipping them.
      lastOffset = NaN;
      if (journey) journey.style.height = "";
      if (contactSurface) contactSurface.style.opacity = "0";
      // Clear the pinned-mode foreground clip so the ordinary document shows
      // its full content.
      document
        .querySelectorAll<HTMLElement>("[data-scene] .section-content, [data-scene] .site-footer")
        .forEach((element) => (element.style.clipPath = ""));
      const ordinary =
        document.documentElement.scrollHeight - window.innerHeight;
      if (ordinary > 0) {
        window.scrollTo({ top: preserved * ordinary, behavior: "instant" });
      }
      // In the ordinary document the navbar still themes over the violet band
      // from its real viewport geometry.
      syncOrdinaryHeader();
      return;
    }
    measure();
    if (layout && layout.scroll > 0) {
      window.scrollTo({
        top: preserved * layout.scroll,
        behavior: "instant",
      });
    }
    startLoop();
    requestRender();
  }

  function preferenceChange() {
    setActive(!preference.matches);
  }

  // A hidden document must truly pause the motion clock; otherwise the hidden
  // interval is integrated on return. Rebase the loop clock when it resumes.
  function visibility() {
    if (document.hidden) {
      stopLoop();
      return;
    }
    if (active) startLoop();
  }

  // A viewport resize changes the Contact band's position under the fixed
  // navbar. The pinned presentation re-renders its transforms; the ordinary
  // document only needs the header theme refreshed.
  function handleResize() {
    if (!active) {
      syncOrdinaryHeader();
      return;
    }
    requestRender();
  }

  const resizeObserver = new ResizeObserver(() => {
    if (!active) {
      // Ordinary/reduced layout: re-theme from real geometry only.
      syncOrdinaryHeader();
      return;
    }
    measure();
    requestRender();
  });
  if (journey) resizeObserver.observe(journey);
  for (const scene of scenes) if (scene) resizeObserver.observe(scene);

  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("resize", handleResize);
  window.addEventListener("hashchange", hash);
  document.addEventListener("click", anchorClick);
  document.addEventListener("focusin", focusIn);
  document.addEventListener("visibilitychange", visibility);
  preference.addEventListener("change", preferenceChange);

  // Activate only without a reduced-motion preference; reduced motion keeps the
  // ordinary, fully readable document. The ordinary document still themes the
  // fixed navbar from real Contact geometry, including at initial load and for
  // a deep link that already scrolled before this module ran.
  setActive(!preference.matches);
  if (active) render();
  else syncOrdinaryHeader();
  if (window.location.hash) hash();

  return () => {
    window.clearTimeout(velocityTimer);
    if (frame) cancelAnimationFrame(frame);
    stopLoop();
    resizeObserver.disconnect();
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("hashchange", hash);
    document.removeEventListener("click", anchorClick);
    document.removeEventListener("focusin", focusIn);
    document.removeEventListener("visibilitychange", visibility);
    preference.removeEventListener("change", preferenceChange);
  };
}
