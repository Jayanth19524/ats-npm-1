export function installCredentialedFetch(): void {
  if (typeof window === "undefined") return;
  const original = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    return original(input, { credentials: "include", ...(init ?? {}) });
  }) as typeof window.fetch;
}
