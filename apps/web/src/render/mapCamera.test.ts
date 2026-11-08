import { describe, expect, it } from 'vitest';
import {
  cameraPosition, clampView, dragView, initialView, MAX_DISTANCE, MAX_PITCH, MIN_DISTANCE, MIN_PITCH, scrollView, turnView, unitsPerPixel, zoomView,
} from './mapCamera';

describe('initialView', () => {
  it('looks at the middle of the map from the south-east, the way the 2.5D map was seen', () => {
    const view = initialView(150);

    const camera = cameraPosition(view);

    expect(view.target).toEqual({ x: 75, y: 75 });
    expect(camera.x).toBeGreaterThan(75);
    expect(camera.z).toBeGreaterThan(75);
    expect(camera.y).toBeGreaterThan(0);
  });
});

describe('cameraPosition', () => {
  it('stands the camera at its distance from the target, at the pitch above the ground', () => {
    const view = { ...initialView(150), distance: 100, pitch: Math.PI / 6 };

    const camera = cameraPosition(view);

    expect(Math.hypot(camera.x - 75, camera.y, camera.z - 75)).toBeCloseTo(100);
    expect(camera.y).toBeCloseTo(50);
  });
});

describe('dragView', () => {
  it('moves the view the opposite way to a drag, by the distance the pointer covered on the ground', () => {
    const view = initialView(150);
    const height = 800;

    const dragged = dragView(view, 100, 0, height);

    // Screen right is (cos 45°, -sin 45°) on the map: dragging right shows what lies to the left of it.
    const moved = { x: dragged.target.x - 75, y: dragged.target.y - 75 };
    expect(moved.x).toBeLessThan(0);
    expect(moved.y).toBeGreaterThan(0);
    expect(Math.hypot(moved.x, moved.y)).toBeCloseTo(100 * unitsPerPixel(view, height));
  });

  it('shows more of the far side when the map is dragged down', () => {
    const view = initialView(150);

    const dragged = dragView(view, 0, 100, 800);

    expect(dragged.target.x).toBeLessThan(75);
    expect(dragged.target.y).toBeLessThan(75);
  });
});

describe('scrollView', () => {
  it('shows what is lower on the screen when scrolled down, toward the camera', () => {
    const view = initialView(150);

    const scrolled = scrollView(view, 0, 100, 800);

    expect(scrolled.target.x).toBeGreaterThan(75);
    expect(scrolled.target.y).toBeGreaterThan(75);
  });
});

describe('clampView', () => {
  it('keeps the target on the map and the zoom and tilt within their limits', () => {
    const wild = { target: { x: -20, y: 400 }, distance: 5000, yaw: 1, pitch: 3 };

    const clamped = clampView(wild, 150);

    expect(clamped.target).toEqual({ x: 0, y: 150 });
    expect(clamped.distance).toBe(MAX_DISTANCE);
    expect(clamped.pitch).toBe(MAX_PITCH);
    expect(clampView({ ...wild, distance: 1, pitch: 0 }, 150)).toMatchObject({ distance: MIN_DISTANCE, pitch: MIN_PITCH });
  });
});

describe('zoomView and turnView', () => {
  it('comes closer below 1 and turns and tilts by the pointer drag', () => {
    const view = initialView(150);

    expect(zoomView(view, 0.5).distance).toBeCloseTo(view.distance / 2);
    expect(turnView(view, 100, 0).yaw).toBeLessThan(view.yaw);
    expect(turnView(view, 0, 100).pitch).toBeGreaterThan(view.pitch);
  });
});
