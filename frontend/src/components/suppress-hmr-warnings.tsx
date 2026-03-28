"use client";

import { useEffect } from "react";

/**
 * Suppress harmless custom element registration warnings from HMR.
 * These warnings occur during hot module replacement and can be safely ignored.
 */
export function suppressHmrWarnings() {
  useEffect(() => {
    // Suppress CustomElementRegistry warnings from HMR
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const message = args[0];
      if (
        typeof message === "string" &&
        message.includes('CustomElementRegistry"') &&
        message.includes("already has")
      ) {
        return;
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);
}
