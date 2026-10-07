<script lang="ts">
  import { onMount } from "svelte";

  let field: HTMLDivElement;
  let canvas: HTMLCanvasElement | undefined;
  let frame = 0;
  let running = false;
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;

  const maximumDisplacement = 24;

  function draw() {
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const { width, height } = field.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "rgba(214, 255, 51, 0.8)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(width * 0.14, height * 0.56);
    context.lineTo(width * 0.42, height * 0.36);
    context.lineTo(width * 0.7, height * 0.64);
    context.lineTo(width * 0.92, height * 0.22);
    context.stroke();
  }

  function stop() {
    running = false;
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  function animate() {
    if (!canvas) {
      running = false;
      return;
    }

    frame = 0;
    currentX += (targetX - currentX) * 0.16;
    currentY += (targetY - currentY) * 0.16;
    canvas.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

    if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
      frame = requestAnimationFrame(animate);
      return;
    }

    currentX = targetX;
    currentY = targetY;
    canvas.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    running = false;
  }

  function start() {
    if (!running && !document.hidden) {
      running = true;
      frame = requestAnimationFrame(animate);
    }
  }

  function handlePointerMove(event: PointerEvent) {
    const bounds = field.getBoundingClientRect();
    if (!bounds) return;

    targetX = Math.max(-maximumDisplacement, Math.min(maximumDisplacement, ((event.clientX - bounds.left) / bounds.width - 0.5) * maximumDisplacement * 2));
    targetY = Math.max(-maximumDisplacement, Math.min(maximumDisplacement, ((event.clientY - bounds.top) / bounds.height - 0.5) * maximumDisplacement * 2));
    start();
  }

  function resetPointer() {
    targetX = 0;
    targetY = 0;
    start();
  }

  function handleVisibilityChange() {
    if (document.hidden) stop();
  }

  onMount(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resizeObserver = new ResizeObserver(draw);

    function syncMotionPreference() {
      stop();
      currentX = currentY = targetX = targetY = 0;
      if (motionPreference.matches) {
        canvas?.remove();
        canvas = undefined;
        field.classList.remove("has-canvas");
        return;
      }

      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        field.append(canvas);
        field.classList.add("has-canvas");
      }
      canvas.style.transform = "translate3d(0, 0, 0)";
      draw();
    }

    syncMotionPreference();
    resizeObserver.observe(field);
    motionPreference.addEventListener("change", syncMotionPreference);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      resizeObserver.disconnect();
      motionPreference.removeEventListener("change", syncMotionPreference);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvas?.remove();
    };
  });
</script>

<div class="signal-field" aria-hidden="true" bind:this={field} onpointermove={handlePointerMove} onpointerleave={resetPointer}>
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="14,56 42,36 70,64 92,22" fill="none" stroke="rgba(214, 255, 51, 0.8)" stroke-width="1" vector-effect="non-scaling-stroke" />
  </svg>
</div>
