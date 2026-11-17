import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { primeSession } from "./api/client";
import { App } from "./app/App";
import { createQueryClient, Providers } from "./app/Providers";
import { prefetchRouteData, preloadRoute } from "./app/routes";
import "./index.css";

// Start-up work that does not need React: restore the session, fetch the page's code and, once
// signed in, the page's data, all at the same time instead of one after another.
const queryClient = createQueryClient();
const { pathname } = window.location;
preloadRoute(pathname);
primeSession()
  .then((user) => {
    if (user) prefetchRouteData(queryClient, pathname);
  })
  .catch(() => {});

// How the person is moving around: Tab means the keyboard, any press means touch or mouse. Rings
// that browsers would also draw after a tap (on fields focused for typing) check this first.
const html = document.documentElement;
document.addEventListener("keydown", (event) => event.key === "Tab" && (html.dataset.input = "keyboard"), true);
document.addEventListener("pointerdown", () => (html.dataset.input = "pointer"), true);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Providers client={queryClient}>
        <App />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);
