// jsdom não calcula layout. A dimensão/animação é verificada no Playwright;
// nos testes DOM o observer só precisa oferecer o ciclo de vida do navegador.
if (typeof window !== 'undefined') {
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
}
