/** Wheel movement in CSS pixels; browsers may report pixels, lines or pages. */
export function wheelScrollDelta(
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey'>,
  viewport: { width: number; height: number },
): { x: number; y: number } {
  const line = event.deltaMode === 1 ? 16 : 1;
  const x = event.deltaMode === 2 ? event.deltaX * viewport.width : event.deltaX * line;
  const y = event.deltaMode === 2
    ? event.deltaY * (event.shiftKey ? viewport.width : viewport.height)
    : event.deltaY * line;
  return { x: x + (event.shiftKey ? y : 0), y: event.shiftKey ? 0 : y };
}
