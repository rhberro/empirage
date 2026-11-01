import { ChakraProvider } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { QueryProvider } from "./query";
import { router } from "./routes";
import { system } from "./theme";

const rootEl = document.querySelector("#root");

if (!rootEl) {
  throw new Error("Root element #root not found.");
}

function preventGestureStart(event: Event): void {
  event.preventDefault();
}

document.addEventListener("gesturestart", preventGestureStart);

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      forcedTheme="dark"
    >
      <ChakraProvider value={system}>
        <QueryProvider>
          <RouterProvider router={router} />
        </QueryProvider>
      </ChakraProvider>
    </ThemeProvider>
  </StrictMode>,
);
