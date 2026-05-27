export interface CaptureResult {
  photoUri: string;
  placeName: string | null;
}

let _pending: CaptureResult | null = null;

export function setPendingCapture(result: CaptureResult): void {
  _pending = result;
}

export function consumePendingCapture(): CaptureResult | null {
  const result = _pending;
  _pending = null;
  return result;
}
