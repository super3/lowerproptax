// SSE client management - maintains connected clients and broadcasts events

const clients = new Set();

/**
 * Set up an SSE connection on the given response object.
 * Sends headers, adds to client set, sets up keepalive and cleanup.
 */
export function addClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send initial comment so client knows connection is alive
  res.write(': connected\n\n');

  // Keepalive every 30 seconds to prevent proxy/Railway timeouts
  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  clients.add(res);

  req.on('close', () => {
    clearInterval(keepalive);
    clients.delete(res);
  });
}

/**
 * Emit an event to all connected SSE clients.
 * Safe to call with zero connected clients (no-op loop over empty Set).
 */
export function emitEvent(type, data) {
  const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(message);
  }
}

/**
 * Get the current number of connected clients (for testing/monitoring).
 */
export function getClientCount() {
  return clients.size;
}
