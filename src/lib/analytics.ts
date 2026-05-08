export function track(event: string, props?: Record<string, unknown>): void {
  if (__DEV__) {
    console.log('[analytics]', event, props);
  }
}
