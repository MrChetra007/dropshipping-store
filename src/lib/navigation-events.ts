export const NAVIGATION_START_EVENT = "app:navigation-start";

/**
 * Ask the global navigation progress bar to start. Call this before any
 * programmatic navigation (router.push/replace/refresh) so the user gets
 * immediate feedback even when the URL does not change.
 */
export function startNavigation() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
}
