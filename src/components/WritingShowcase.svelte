<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";
  import type { WritingEntry } from "../lib/writing";
  import { padIndex } from "../lib/writing";
  import SectionHeading from "./SectionHeading.svelte";

  /**
   * The Writing section: the newest entries as a feed, with a plate that changes
   * as the visitor moves down it.
   *
   * The list is the content. The plate beside it is decorative: it shows the
   * entry the visitor is on, and every entry is still a real link with its
   * title, deck and date in the flow. Because the feed is driven by whatever is
   * newest, nothing here assumes a particular article — the section reads the
   * list it is given, and works for one entry or ten.
   *
   * Motion is split in two. The plate's entrance and its crossfade are GSAP
   * timelines owned here; the rows' own fade-in is the page module's
   * `data-reveal` work, so this component never writes the properties that
   * module owns. Reduced motion keeps the plate on its first entry and drops the
   * crossfade, the parallax and the touch auto-cycle.
   */
  let { entries, allHref = "/writing" }: {
    entries: WritingEntry[];
    allHref?: string;
  } = $props();

  let host: HTMLDivElement;
  let plate: HTMLDivElement;
  let plates: HTMLDivElement[] = [];
  let rows: HTMLAnchorElement[] = [];
  let active = 0;
  let mounted = false;

  const motionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");
  const touchFirst = () => window.matchMedia("(hover: none)").matches;

  /** Show one entry's plate, crossfading from whichever was showing. */
  function select(index: number, animate: boolean) {
    if (!mounted || index === active && animate) return;
    const previous = active;
    active = index;
    rows.forEach((row, rowIndex) => row.toggleAttribute("data-active", rowIndex === index));
    const still = !animate || motionQuery().matches;
    if (still) {
      plates.forEach((node, plateIndex) => {
        node.style.opacity = plateIndex === index ? "1" : "0";
        node.style.transform = "none";
      });
      return;
    }
    const incoming = plates[index];
    const outgoing = plates[previous];
    if (!incoming) return;
    gsap.killTweensOf(plates);
    gsap.set(incoming, { zIndex: 2, opacity: 0, scale: 1.04 });
    gsap.to(incoming, {
      opacity: 1,
      scale: 1,
      duration: 0.7,
      ease: "power3.out",
      onComplete: () => {
        // Hand the finished plate back to the stack, so the next change starts
        // from a clean layer instead of accumulating z-indexes.
        gsap.set(incoming, { zIndex: 1 });
        gsap.set(outgoing, { opacity: 0 });
      },
    });
  }

  onMount(() => {
    mounted = true;
    const motion = motionQuery();
    plates = [...host.querySelectorAll<HTMLDivElement>(".writing-plate")];
    rows = [...host.querySelectorAll<HTMLAnchorElement>(".writing-row")];

    const paint = (index: number, animate: boolean) => select(index, animate);

    paint(0, false);

    /* ---- entrance ------------------------------------------------------- */
    let entered = false;
    let visible = false;
    let cycle = 0;

    function playEntrance() {
      if (motion.matches) return;
      gsap.from(plate, {
        opacity: 0,
        scale: 0.97,
        duration: 1,
        ease: "power3.out",
      });
    }

    function startCycle() {
      if (cycle || motion.matches || !touchFirst() || !visible || document.hidden) return;
      if (entries.length < 2) return;
      cycle = window.setInterval(() => {
        if (!visible || document.hidden || motion.matches) return;
        paint((active + 1) % entries.length, true);
      }, 5200);
    }

    function stopCycle() {
      if (cycle) window.clearInterval(cycle);
      cycle = 0;
    }

    const observer = new IntersectionObserver(
      (observed) => {
        visible = observed.some((entry) => entry.isIntersecting);
        if (visible && !entered) {
          entered = true;
          playEntrance();
        }
        if (visible) startCycle();
        else stopCycle();
      },
      { threshold: 0.2 },
    );
    observer.observe(host);

    /* ---- pointer -------------------------------------------------------- */
    let rotateX: ((value: number) => void) | undefined;
    let rotateY: ((value: number) => void) | undefined;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    if (finePointer.matches && !motion.matches) {
      gsap.set(plate, { transformPerspective: 1200 });
      rotateX = gsap.quickTo(plate, "rotationX", { duration: 0.8, ease: "power3.out" });
      rotateY = gsap.quickTo(plate, "rotationY", { duration: 0.8, ease: "power3.out" });
    }

    function move(event: PointerEvent) {
      if (!rotateX || !rotateY || event.pointerType !== "mouse") return;
      const box = plate.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      rotateY?.(x * 7);
      rotateX?.(-y * 7);
    }

    function rest() {
      rotateX?.(0);
      rotateY?.(0);
    }

    /* ---- preferences and visibility ------------------------------------ */
    function syncPreference() {
      if (motion.matches) {
        stopCycle();
        gsap.killTweensOf([plate, ...plates]);
        gsap.set(plate, { clearProps: "opacity,transform" });
        rest();
        select(active, false);
      } else {
        startCycle();
      }
    }

    function syncVisibility() {
      if (document.hidden) stopCycle();
      else startCycle();
    }

    plate.addEventListener("pointermove", move);
    plate.addEventListener("pointerleave", rest);
    motion.addEventListener("change", syncPreference);
    document.addEventListener("visibilitychange", syncVisibility);

    // Rows switch the plate on hover and on focus, so the same visual works for
    // a mouse, a keyboard, and a touch tap that focuses the link.
    const bind = rows.map((row, index) => {
      const enter = () => paint(index, true);
      row.addEventListener("pointerenter", enter);
      row.addEventListener("focus", enter);
      return { row, enter };
    });

    return () => {
      observer.disconnect();
      stopCycle();
      plate.removeEventListener("pointermove", move);
      plate.removeEventListener("pointerleave", rest);
      motion.removeEventListener("change", syncPreference);
      document.removeEventListener("visibilitychange", syncVisibility);
      for (const { row, enter } of bind) {
        row.removeEventListener("pointerenter", enter);
        row.removeEventListener("focus", enter);
      }
      gsap.killTweensOf([plate, ...plates]);
    };
  });
</script>

<div class="writing-layout" bind:this={host}>
  <div class="writing-head">
    <div class="writing-heading">
      <SectionHeading
        index="02"
        label="Writing"
        headingId="writing-heading"
        title="Latest writing."
        intro="Notes from the work: reverse-engineering writeups, and what the tools left out."
      />
    </div>
    <a class="writing-all" href={allHref}>
      All writing <span aria-hidden="true">↗</span>
    </a>
  </div>

  <div class="writing-grid" data-count={entries.length}>
    <!--
      The plate is a picture of the entry the visitor is on, not a control. The
      list beside it carries every link, so nothing here is the only route to an
      article.
    -->
    <div
      class="writing-plate-frame"
      bind:this={plate}
      aria-hidden="true"
      style={`--plate-ratio: ${entries[0]?.imageSize.width ?? 4} / ${entries[0]?.imageSize.height ?? 5}`}
    >
      <div class="writing-plates">
        {#each entries as entry, index}
          <div class="writing-plate" data-active={index === 0 ? "" : undefined}>
            <img
              src={entry.image}
              alt=""
              width={entry.imageSize.width}
              height={entry.imageSize.height}
              loading="lazy"
              decoding="async"
            />
          </div>
        {/each}
      </div>
    </div>

    <ol class="writing-feed" aria-label="Latest writing">
      {#each entries as entry, index}
        <li data-reveal data-enter="right" data-enter-delay={(index * 0.07).toFixed(2)}>
          <a
            class="writing-row"
            data-active={index === 0 ? "" : undefined}
            href={`/writing/${entry.slug}`}
          >
            <span class="writing-row-index" aria-hidden="true">{padIndex(index)}</span>
            <span class="writing-row-body">
              <span class="writing-row-meta">
                <time datetime={entry.date}>{entry.dateLabel}</time>
                <span aria-hidden="true">·</span>
                <span>{entry.kind}</span>
              </span>
              <span class="writing-row-title">{entry.title}</span>
              <span class="writing-row-deck">{entry.deck}</span>
            </span>
            <span class="writing-row-arrow" aria-hidden="true">↗</span>
          </a>
        </li>
      {/each}
    </ol>
  </div>
</div>
