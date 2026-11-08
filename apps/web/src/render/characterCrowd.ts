import * as THREE from 'three';
import { CHARACTER_PARTS, characterMaterials } from './characterModel';
import type { NpcPose } from './npcPose';

const UP = new THREE.Vector3(0, 1, 0);
const SHADOW_HEIGHT = 0.04;

/**
 * Many block characters drawn at once: the same six boxes and faces as `createCharacter`, but every
 * part of every figure of one coat is an instance of a single mesh, so a crowd costs a few dozen
 * draw calls instead of thousands. Figures cannot fade or be picked; a frame is `begin`, an `add`
 * for each figure, then `end`.
 */
export class CharacterCrowd {
  private readonly root = new THREE.Group();
  private readonly meshes: THREE.InstancedMesh[][];
  private readonly shadows: THREE.InstancedMesh;
  private readonly counts: number[];
  private shadowCount = 0;
  private readonly geometries = CHARACTER_PARTS.map((part) => new THREE.BoxGeometry(...part.size));
  private readonly materials: THREE.Material[];
  private readonly shadowGeometry = new THREE.CircleGeometry(1, 16);
  private readonly shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  private readonly base = new THREE.Matrix4();
  private readonly part = new THREE.Matrix4();
  private readonly step = new THREE.Matrix4();
  private readonly turn = new THREE.Quaternion();
  private readonly place = new THREE.Vector3();
  private readonly size = new THREE.Vector3();

  /** `coats` are the body colours, `capacity` the most figures of each; `scale` sizes a figure unit in map units. */
  constructor(parent: THREE.Object3D, coats: readonly number[], private readonly capacity: number, private readonly scale: number, private readonly shadowRadius: number) {
    const sets = coats.map(characterMaterials);
    this.materials = sets.flatMap((set) => Object.values(set).flat());
    this.meshes = sets.map((set) =>
      CHARACTER_PARTS.map((part, index) => {
        const mesh = new THREE.InstancedMesh(this.geometries[index]!, set[part.materials], capacity);
        mesh.frustumCulled = false;
        mesh.count = 0;
        this.root.add(mesh);
        return mesh;
      }),
    );
    this.counts = coats.map(() => 0);
    this.shadows = new THREE.InstancedMesh(this.shadowGeometry, this.shadowMaterial, capacity * coats.length);
    this.shadows.frustumCulled = false;
    this.shadows.count = 0;
    this.root.add(this.shadows);
    parent.add(this.root);
  }

  begin(): void {
    this.counts.fill(0);
    this.shadowCount = 0;
  }

  /** Puts a figure of the coat at index `coat` on the ground at (`x`, `y`, `z`) facing `heading`; ignored once that coat is full. */
  add(coat: number, x: number, y: number, z: number, heading: number, pose: NpcPose): void {
    const index = this.counts[coat];
    if (index === undefined || index >= this.capacity) return;
    this.counts[coat] = index + 1;
    this.base.compose(this.place.set(x, y, z), this.turn.setFromAxisAngle(UP, heading), this.size.setScalar(this.scale));
    CHARACTER_PARTS.forEach((part, partIndex) => {
      this.part.makeTranslation(part.joint[0], part.joint[1], 0);
      if (part.motion) {
        const angle = part.motion.sign * pose[part.motion.limb];
        if (part.motion.limb === 'head') this.step.makeRotationY(angle);
        else this.step.makeRotationX(angle);
        this.part.multiply(this.step);
      }
      this.part.multiply(this.step.makeTranslation(0, part.centre, 0));
      this.part.premultiply(this.base);
      this.meshes[coat]![partIndex]!.setMatrixAt(index, this.part);
    });
    this.part.makeRotationX(-Math.PI / 2).setPosition(x, y + SHADOW_HEIGHT, z);
    this.part.scale(this.size.setScalar(this.shadowRadius));
    this.shadows.setMatrixAt(this.shadowCount++, this.part);
  }

  end(): void {
    this.meshes.forEach((parts, coat) => {
      for (const mesh of parts) {
        mesh.count = this.counts[coat]!;
        mesh.instanceMatrix.needsUpdate = true;
      }
    });
    this.shadows.count = this.shadowCount;
    this.shadows.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const parts of this.meshes) for (const mesh of parts) mesh.dispose();
    this.shadows.dispose();
    for (const geometry of [...this.geometries, this.shadowGeometry]) geometry.dispose();
    for (const material of [...this.materials, this.shadowMaterial]) material.dispose();
  }
}
