import { FROM_BRIDGE, FROM_CONTENT, type Envelope, type Request, type Response } from '../lib/messages.js';

/**
 * Relay only. The MAIN-world bridge owns the ag-Grid columns but cannot
 * reach chrome.runtime; this isolated script is the only path between them.
 */

const PUSH_ID = 0;

function toBridge(id: number, payload: Response): void {
  const envelope: Envelope<Response> = { source: FROM_CONTENT, id, payload };
  window.postMessage(envelope, window.location.origin);
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.source !== window) return;
  const envelope = event.data as Envelope<Request> | undefined;
  if (!envelope || envelope.source !== FROM_BRIDGE) return;

  chrome.runtime
    .sendMessage(envelope.payload)
    .then((response: Response) => toBridge(envelope.id, response))
    .catch((err: unknown) =>
      toBridge(envelope.id, {
        kind: 'ERROR',
        message: err instanceof Error ? err.message : String(err),
      }),
    );
});

// Gating batches resolve after the request that asked for them has already
// answered from cache, so the worker pushes them in unsolicited.
chrome.runtime.onMessage.addListener((response: Response) => {
  toBridge(PUSH_ID, response);
});
