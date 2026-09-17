/** Canvas pickers */
export const canvas = {
  pickHttp: {
    noPath: 'No available routes (each route can only have one edge)',
    title: 'Select route',
    hint: 'Choose the route for this edge; cancel removes the edge',
    reselectTitle: 'Reselect route',
    reselectHint: 'Choose the route for this edge; cancel keeps the current one',
  },
  pickBranch: {
    noOutlet: 'No available branch outlets (each outlet can only have one edge)',
    title: 'Select branch outlet',
    hint: 'Choose the outlet for this edge; cancel removes the edge',
  },
  jsEdge: {
    cannotToggle: 'Cannot switch result when two outgoing edges exist',
    maxTwo: 'At most two outgoing edges (Success / Failure)',
    successLabel: 'Success',
    failureLabel: 'Failure',
    pickTitle: 'Select result',
    pickHint: 'With one outgoing edge, choose Success or Failure',
  },
  connection: {
    noSelfLoop: 'Cannot connect a node to itself (would create a loop)',
    ioOnly: 'Connect output to input: right to left (or drag from left to the other node\'s right)',
    entryNoIncoming: 'Entry nodes have no incoming edges',
    exitNoOutgoing: 'Exit nodes have no outgoing edges',
    maxOutgoing: 'Maximum outgoing edges reached',
    noPortsNode: 'This node has no ports and cannot be connected',
  },
  insertNode: {
    message:
      'Insert this node into the current edge?\nThe edge will split into: upstream → this node → downstream.',
    title: 'Insert node',
    confirm: 'Insert',
  },
  minimap: {
    title: 'Navigator',
    open: 'Show minimap',
    close: 'Close',
    menuAria: 'Minimap menu',
    fitAll: 'Fit all',
    exportImage: 'Export image',
    exportOk: 'Canvas image exported',
    exportSelectionOk: 'Selected components exported',
    exportEmpty: 'Canvas is empty; nothing to export',
    exportNoPlugin: 'Export plugin is not ready',
    exportFailed: 'Failed to export image',
  },
}
