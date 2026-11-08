import { inLobby, parcelAt, type WorldView } from '@aiverse/protocol';
import * as THREE from 'three';
import type { GameStore } from '../state/store';
import { activeContents } from '../state/facilityContents';
import { wheelScrollDelta } from '../ui/mapScroll';
import { FacilityLayer } from './FacilityLayer';
import { GroundLayer } from './GroundLayer';
import { LabelLayer } from './LabelLayer';
import { axisTicks, formatCoordinate } from './layout';
import { LobbyLandmark } from './LobbyLandmark';
import {
  cameraPosition, clampView, dragView, FIELD_OF_VIEW, initialView, scrollView, turnView, zoomView, type CameraView,
} from './mapCamera';
import { ResidentLayer } from './ResidentLayer';
import { LIGHT_SCALE } from './sceneKit';

const BACKGROUND = 0x0d141e;
/** How far outside the map edge the tick labels sit, as a fraction of the map side. */
const LABEL_OFFSET = 0.04;
/** Pixels a pointer must travel before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD = 5;

interface Press {
  x: number;
  y: number;
  button: number;
  shift: boolean;
  dragged: boolean;
}

/**
 * Draws the map as a three-dimensional scene from the latest snapshot in the store. Clicking a resident
 * or a facility selects it, clicking the ground selects the parcel there; a Shift click then asks the
 * server to walk the selected resident to that point. The wheel moves the view, Ctrl or a pinch zooms,
 * dragging pans and a right drag turns it.
 */
export class MapRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 1, 4000);
  private readonly ground: GroundLayer;
  private readonly facilities: FacilityLayer;
  private readonly lobby: LobbyLandmark;
  private readonly residents: ResidentLayer;
  private readonly labels: LabelLayer;
  private readonly cursor: HTMLDivElement;
  private readonly raycaster = new THREE.Raycaster();
  private readonly unsubscribe: () => void;
  private readonly resizer: ResizeObserver;
  private view: CameraView | null = null;
  private drawnSize: number | null = null;
  private drawnLayout = '';
  private nextContentExpiry: number | null = null;
  private press: Press | null = null;
  private frame = 0;
  private last = performance.now();
  private width = 1;
  private height = 1;
  private axisIds: string[] = [];

  constructor(private readonly parent: HTMLElement, private readonly store: GameStore) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.domElement.className = 'map-canvas';
    parent.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(BACKGROUND);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55 * LIGHT_SCALE));
    const sun = new THREE.DirectionalLight(0xffffff, 0.75 * LIGHT_SCALE);
    sun.position.set(30, 60, 40);
    this.scene.add(sun);

    this.labels = new LabelLayer(parent);
    this.cursor = document.createElement('div');
    this.cursor.className = 'map-cursor';
    parent.appendChild(this.cursor);
    this.ground = new GroundLayer(this.scene);
    this.facilities = new FacilityLayer(this.scene);
    this.lobby = new LobbyLandmark(this.scene);
    this.residents = new ResidentLayer(this.scene, this.labels, (x, y) => this.lobby.groundHeight(x, y));

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(parent);
    this.resize();

    this.unsubscribe = this.store.subscribe(() => this.sync());
    this.sync();
    this.frame = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.unsubscribe();
    this.resizer.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    canvas.removeEventListener('pointercancel', this.onPointerCancel);
    canvas.removeEventListener('contextmenu', this.onContextMenu);
    canvas.removeEventListener('wheel', this.onWheel);
    this.residents.dispose();
    this.lobby.dispose();
    this.facilities.dispose();
    this.ground.dispose();
    this.labels.dispose();
    this.cursor.remove();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }

  private sync(): void {
    const { world, selected, selectedParcel } = this.store.getState();
    if (!world) return;
    const { size, parcelSize, blockCells, road } = world.map;
    const layout = `${size}:${parcelSize}:${blockCells}:${road}:${world.map.lobby}`;
    const resized = layout !== this.drawnLayout;
    if (resized) this.rebuild(world.map);
    this.ground.setParcels(world.parcels, selectedParcel);
    this.syncFacilities(world);
    this.residents.sync(world.residents, resized);
    this.residents.setSelected(selected);
  }

  private rebuild(map: WorldView['map']): void {
    const { size } = map;
    this.drawnSize = size;
    this.drawnLayout = `${size}:${map.parcelSize}:${map.blockCells}:${map.road}:${map.lobby}`;
    this.ground.build(map);
    if (map.lobby) this.lobby.build(map);
    else this.lobby.dispose();
    this.view ??= initialView(size);
    this.view = clampView(this.view, size);
    for (const id of this.axisIds) this.labels.remove(id);
    this.axisIds = [];
    const axis = (id: string, text: string, x: number, z: number) => {
      this.labels.set(id, text, 'axis', 'centre');
      this.labels.move(id, x, 0, z);
      this.axisIds.push(id);
    };
    const offset = LABEL_OFFSET * size;
    for (const tick of axisTicks(size)) {
      const text = formatCoordinate(tick);
      axis(`x${tick}`, text, tick, -offset);
      axis(`y${tick}`, text, -offset, tick);
    }
    axis('x-name', 'x ↘', size / 2, -2.5 * offset);
    axis('y-name', '↙ y', -2.5 * offset, size / 2);
  }

  private syncFacilities(world: WorldView): void {
    this.facilities.sync(world.parcels, world.map, (facility) => activeContents(facility, (time) => this.store.countdown(time)));
    if (world.game.ended) {
      this.nextContentExpiry = null;
      return;
    }
    const receivedAt = this.store.getState().receivedAt;
    const now = performance.now();
    const future = world.parcels.flatMap((parcel) => parcel.facility?.expiresIn ?? [])
      .map((seconds) => (receivedAt ?? now) + seconds * 1000)
      .filter((time) => time > now);
    this.nextContentExpiry = future.length ? Math.min(...future) : null;
  }

  private resize(): void {
    this.width = Math.max(this.parent.clientWidth, 1);
    this.height = Math.max(this.parent.clientHeight, 1);
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  private readonly tick = (): void => {
    this.frame = requestAnimationFrame(this.tick);
    const now = performance.now();
    const elapsed = Math.min(now - this.last, 100);
    this.last = now;
    if (this.nextContentExpiry !== null && now >= this.nextContentExpiry) {
      const world = this.store.getState().world;
      if (world) this.syncFacilities(world);
    }
    this.facilities.update(now / 1000, elapsed / 1000);
    this.lobby.update(now / 1000, elapsed / 1000);
    this.residents.update(now, elapsed);
    if (this.view) {
      const position = cameraPosition(this.view);
      this.camera.position.set(position.x, position.y, position.z);
      this.camera.lookAt(this.view.target.x, 0, this.view.target.y);
    }
    this.renderer.render(this.scene, this.camera);
    this.labels.project(this.camera, this.width, this.height);
  };

  /** Points the pointer ray from a mouse position in the page. */
  private aim(event: { clientX: number; clientY: number }): void {
    const box = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - box.left) / box.width) * 2 - 1, -(((event.clientY - box.top) / box.height) * 2 - 1));
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  /** The map position under the pointer, or null off the map. */
  private groundPoint(): { x: number; y: number } | null {
    const size = this.drawnSize;
    if (size === null) return null;
    const hit = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!hit || hit.x < 0 || hit.z < 0 || hit.x > size || hit.z > size) return null;
    return { x: hit.x, y: hit.z };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.press = { x: event.clientX, y: event.clientY, button: event.button, shift: event.shiftKey, dragged: false };
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const press = this.press;
    if (press && this.view) {
      const dx = event.clientX - press.x, dy = event.clientY - press.y;
      if (!press.dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      press.dragged = true;
      press.x = event.clientX;
      press.y = event.clientY;
      this.view = clampView(press.button === 2 ? turnView(this.view, dx, dy) : dragView(this.view, dx, dy, this.height), this.drawnSize ?? 0);
      return;
    }
    this.aim(event);
    const point = this.groundPoint();
    this.cursor.textContent = point ? `指针 (${formatCoordinate(point.x)}, ${formatCoordinate(point.y)})` : '';
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const press = this.press;
    this.press = null;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
    if (!press || press.dragged || press.button !== 0) return;
    this.aim(event);
    this.click(press.shift);
  };

  private readonly onPointerCancel = (): void => {
    this.press = null;
  };

  private readonly onPointerLeave = (): void => {
    if (!this.press) this.cursor.textContent = '';
  };

  private readonly onContextMenu = (event: Event): void => event.preventDefault();

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (!this.view) return;
    const view = event.ctrlKey || event.metaKey
      ? zoomView(this.view, Math.exp(event.deltaY * 0.0015))
      : (() => {
          const { x, y } = wheelScrollDelta(event, { width: this.width, height: this.height });
          return scrollView(this.view!, x, y, this.height);
        })();
    this.view = clampView(view, this.drawnSize ?? 0);
  };

  /**
   * Input only expresses intent: selection stays local, a move goes to the server as a primitive.
   * The nearest resident or facility under the pointer is selected; otherwise the ground is.
   */
  private click(shift: boolean): void {
    const world = this.store.getState().world;
    if (!world) return;
    // A Shift click is a walk order to the ground point, so tall boxes in the way must not take it.
    const [hit] = shift ? [] : this.raycaster.intersectObjects([...this.residents.targets(), ...this.facilities.targets()], false);
    const point = this.groundPoint();
    const { selected } = this.store.getState();
    if (hit?.object.userData.residentId) {
      this.store.select(hit.object.userData.residentId as string);
      return;
    }
    if (hit?.object.userData.parcelId) {
      this.store.selectParcel(hit.object.userData.parcelId as string);
    } else if (point) {
      // Roads and the lobby belong to no one and have nothing to select.
      const { col, row, onRoad } = parcelAt(world.map, point.x, point.y);
      if (!onRoad && !(world.map.lobby && inLobby(world.map, col, row))) this.store.selectParcel(`L${col}-${row}`);
    }
    if (selected && point && this.store.isFree(selected) && shift) {
      this.store.act({ type: 'move_to', residentId: selected, target: point });
    }
  }
}

export function createMapRenderer(parent: HTMLElement, store: GameStore): MapRenderer {
  return new MapRenderer(parent, store);
}
