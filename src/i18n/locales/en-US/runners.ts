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
    consoleStart: 'HTTP client debug: run with test value and continue downstream',
    consoleStartOnly: 'HTTP client debug: run this node only with test value',
    success: 'HTTP client finished (with downstream)',
    successOnly: 'HTTP client node finished',
  },
  httpEndpoint: {
    unsupported: 'Only edges from HTTP request nodes can run',
    pathNotFound: 'Route not found',
    defaultName: 'HTTP request',
    consoleStart: 'Simulate {method} {path}',
    success: 'Simulation finished',
  },
  jsTransform: {
    unsupported: 'JS transform node only',
    defaultName: 'JS Transform',
    consoleStart: 'JS transform debug: run with test value and continue downstream',
    consoleStartOnly: 'JS transform debug: run this node only with test value',
    success: 'JS transform finished (with downstream)',
    successOnly: 'JS transform node finished',
  },
}
