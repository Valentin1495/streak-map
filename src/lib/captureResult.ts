export interface CaptureResult {
  photoUri: string;
  placeName: string | null;
}

let _pending: CaptureResult | null = null;
let _pendingReplacementSource: string | null = null;

export function setPendingCapture(result: CaptureResult): void {
  _pending = result;
}

export function consumePendingCapture(): CaptureResult | null {
  const result = _pending;
  _pending = null;
  return result;
}

export function setPendingReplacementSource(source: string): void {
  _pendingReplacementSource = source;
}

export function consumePendingReplacementSource(): string | null {
  const source = _pendingReplacementSource;
  _pendingReplacementSource = null;
  return source;
}
