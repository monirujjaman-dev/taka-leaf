import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "../app/App";
import { createQueryClient, Providers } from "../app/Providers";

export function renderApp(path = "/") {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0 } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Providers client={client}>
        <App />
      </Providers>
    </MemoryRouter>,
  );
}
