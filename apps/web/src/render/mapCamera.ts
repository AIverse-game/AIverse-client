/** How the map is seen: the point looked at, how far away, and the angles around and above it. */
export interface CameraView {
  /** Ground point at the middle of the screen, in map units. */
  target: { x: number; y: number };
  distance: number;
  /** Turn about the vertical in radians; 45° puts the camera over the south-east corner, the origin at the far top. */
  yaw: number;
  /** Angle between the line of sight and the ground. */
  pitch: number;
}

export const FIELD_OF_VIEW = 30;
export const MIN_DISTANCE = 25;
export const MAX_DISTANCE = 600;
export const MIN_PITCH = (20 * Math.PI) / 180;
export const MAX_PITCH = (85 * Math.PI) / 180;

/** Starts on the map's middle, where residents are born, from the south-east at 40°, as the 2.5D map was seen. */
export function initialView(mapSize: number): CameraView {
  return { target: { x: mapSize / 2, y: mapSize / 2 }, distance: 72, yaw: Math.PI / 4, pitch: (40 * Math.PI) / 180 };
}

/** Where the camera stands, in world coordinates: x east, y up, z south (the map's y). */
export function cameraPosition(view: CameraView): { x: number; y: number; z: number } {
  const flat = Math.cos(view.pitch) * view.distance;
  return {
    x: view.target.x + flat * Math.sin(view.yaw),
    y: Math.sin(view.pitch) * view.distance,
    z: view.target.y + flat * Math.cos(view.yaw),
  };
}

/** Map units that one screen pixel covers across the screen at the target, for a viewport `height` pixels tall. */
export function unitsPerPixel(view: CameraView, height: number): number {
  return (2 * view.distance * Math.tan((FIELD_OF_VIEW * Math.PI) / 360)) / height;
}

/** Keeps the target on the map and the zoom and tilt within their limits. */
export function clampView(view: CameraView, mapSize: number): CameraView {
  return {
    ...view,
    target: { x: Math.min(Math.max(view.target.x, 0), mapSize), y: Math.min(Math.max(view.target.y, 0), mapSize) },
    distance: Math.min(Math.max(view.distance, MIN_DISTANCE), MAX_DISTANCE),
    pitch: Math.min(Math.max(view.pitch, MIN_PITCH), MAX_PITCH),
  };
}

/** Moves the target as if the map were dragged by (dx, dy) screen pixels: dragging right moves the view left. */
export function dragView(view: CameraView, dx: number, dy: number, height: number): CameraView {
  const unit = unitsPerPixel(view, height);
  const along = (unit * dy) / Math.sin(view.pitch);
  const right = { x: Math.cos(view.yaw), y: -Math.sin(view.yaw) };
  const ahead = { x: -Math.sin(view.yaw), y: -Math.cos(view.yaw) };
  return {
    ...view,
    target: { x: view.target.x - right.x * dx * unit + ahead.x * along, y: view.target.y - right.y * dx * unit + ahead.y * along },
  };
}

/** Moves the view by (dx, dy) scrolled pixels, as scrolling a page: positive dy shows what is lower on the screen. */
export function scrollView(view: CameraView, dx: number, dy: number, height: number): CameraView {
  return dragView(view, -dx, -dy, height);
}

/** Brings the camera closer by `factor` below 1, or away above 1. */
export function zoomView(view: CameraView, factor: number): CameraView {
  return { ...view, distance: view.distance * factor };
}

/** Turns the camera around the target and tilts it, by screen pixels dragged. */
export function turnView(view: CameraView, dx: number, dy: number): CameraView {
  return { ...view, yaw: view.yaw - dx * 0.008, pitch: view.pitch + dy * 0.005 };
}
