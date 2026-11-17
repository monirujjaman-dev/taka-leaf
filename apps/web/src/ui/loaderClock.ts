/*
 * One clock for every full-size loader. Start-up shows the static copy in index.html, then React's
 * "Opening TakaLeaf…" (once for the session check, again while the page's code loads). Without a
 * shared clock each one restarts the assembly from the scattered pose, so the pieces visibly snap
 * back at every hand-off. With it, each new loader picks up the cycle where the last one was.
 */
let epoch: number | null = null;

/** Reads the boot loader's running animation before React replaces it (main.tsx, before render). */
export function adoptBootLoader() {
  const scene = document.querySelector<HTMLElement>(".tl-boot .tl-loader-scene");
  const time = scene?.getAnimations?.()[0]?.currentTime;
  if (typeof time === "number" && Number.isFinite(time)) epoch = performance.now() - time;
}

/** Milliseconds into the shared loader cycle; the first caller starts the clock if nothing booted. */
export function loaderElapsed(): number {
  epoch ??= performance.now();
  return performance.now() - epoch;
}
