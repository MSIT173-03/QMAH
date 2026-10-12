/** Shared phone breakpoint in CSS viewport pixels; devicePixelRatio and device model do not affect this match. */
export const PHONE_MAX_WIDTH_CSS_PX = 767.98;
export const PHONE_MEDIA_QUERY = `(max-width: ${PHONE_MAX_WIDTH_CSS_PX}px)`;

export function isPhoneViewport(view: Window | null | undefined): boolean {
  if (!view) return false;
  return typeof view.matchMedia === 'function'
    ? view.matchMedia(PHONE_MEDIA_QUERY).matches
    : view.innerWidth <= PHONE_MAX_WIDTH_CSS_PX;
}
