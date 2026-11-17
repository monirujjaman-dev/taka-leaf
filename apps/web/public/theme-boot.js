try {
  var stored = localStorage.getItem("takaleaf.theme");
  var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
} catch (e) {
  // Storage blocked: app/theme.tsx sets the theme when the app starts.
}
