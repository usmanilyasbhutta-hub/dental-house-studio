// Runs the wax-up measurement off the main thread so the screen stays responsive. On-device only.
import { analyseWaxup, parseStl, type Mesh } from "./waxup";

export type WaxJob = { original?: ArrayBuffer; waxup: ArrayBuffer };
export type WaxReply =
  | { ok: true; original?: Mesh; waxup: Mesh; result?: ReturnType<typeof analyseWaxup> }
  | { ok: false; error: string };

self.onmessage = (e: MessageEvent<WaxJob>) => {
  try {
    const waxup = parseStl(e.data.waxup);
    const original = e.data.original ? parseStl(e.data.original) : undefined;
    const result = original ? analyseWaxup(original, waxup) : undefined;
    const reply: WaxReply = { ok: true, original, waxup, result };
    const transfer: Transferable[] = [waxup.pos.buffer, waxup.idx.buffer];
    if (original) transfer.push(original.pos.buffer, original.idx.buffer);
    if (result) transfer.push(result.th.d.buffer, result.th.pos.buffer);
    (self as unknown as Worker).postMessage(reply, transfer);
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) } satisfies WaxReply);
  }
};
