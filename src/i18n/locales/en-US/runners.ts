/** Runners */
export const runners = {
  noRunner: 'No runner available for this selection',
  inject: {
    unsupported: 'Inject node only',
    defaultName: 'Inject',
    consoleStart: 'Inject: write payload and run downstream',
    success: 'Inject finished',
  },
  httpClient: {
    unsupported: 'HTTP client node only',
    defaultName: 'HTTP client',
    consoleStart: 'HTTP client debug: run with test value as upstream message',
    success: 'HTTP client finished',
  },
  httpEndpoint: {
    unsupported: 'Only edges from HTTP request nodes can run',
    pathNotFound: 'Route not found',
    defaultName: 'HTTP request',
    consoleStart: 'Simulate {method} {path}',
    success: 'Simulation finished',
  },
}
