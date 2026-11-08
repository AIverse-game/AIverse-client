import * as THREE from 'three';

interface Label {
  element: HTMLDivElement;
  position: THREE.Vector3;
  /** Whether the point sits at the bottom middle of the text, as for a name, or at its centre. */
  anchor: 'bottom' | 'centre';
}

/** Text over the scene, kept in the page rather than in the picture so it stays sharp at any zoom. */
export class LabelLayer {
  private readonly root: HTMLDivElement;
  private readonly labels = new Map<string, Label>();
  private readonly point = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'map-labels';
    parent.appendChild(this.root);
  }

  /** Creates the label if it is new; returns its element so a caller can restyle it. */
  set(id: string, text: string, className: string, anchor: Label['anchor'] = 'bottom'): HTMLDivElement {
    let label = this.labels.get(id);
    if (!label) {
      const element = document.createElement('div');
      this.root.appendChild(element);
      label = { element, position: new THREE.Vector3(), anchor };
      this.labels.set(id, label);
    }
    label.element.className = `map-label ${className}`;
    if (label.element.textContent !== text) label.element.textContent = text;
    return label.element;
  }

  move(id: string, x: number, y: number, z: number): void {
    this.labels.get(id)?.position.set(x, y, z);
  }

  remove(id: string): void {
    this.labels.get(id)?.element.remove();
    this.labels.delete(id);
  }

  /** Puts every label over the screen position of its world point; those behind the camera are hidden. */
  project(camera: THREE.Camera, width: number, height: number): void {
    for (const { element, position, anchor } of this.labels.values()) {
      this.point.copy(position).project(camera);
      const visible = this.point.z > -1 && this.point.z < 1 && Math.abs(this.point.x) < 1.1 && Math.abs(this.point.y) < 1.1;
      element.style.display = visible ? '' : 'none';
      if (visible) element.style.transform = `translate(${((this.point.x + 1) / 2) * width}px, ${((1 - this.point.y) / 2) * height}px) translate(-50%, ${anchor === 'bottom' ? '-100%' : '-50%'})`;
    }
  }

  dispose(): void {
    this.root.remove();
    this.labels.clear();
  }
}
