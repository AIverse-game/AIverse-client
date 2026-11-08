import * as THREE from 'three';
import { canvasTex } from './sceneKit';
import type { NpcPose } from './npcPose';

const SKIN = '#E8B98A';
const HAIR = '#2C2C2A';
const PANTS = '#5F5E5A';
const SHOE = '#2C2C2A';

/** Height of the demo character in its own units; scale the root to size it on the map. */
export const CHARACTER_HEIGHT = 32;

const solid = (color: number | string) => new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });

function faceTexture(draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  return canvasTex(8, 8, draw);
}

/** Textures that do not depend on the character's colours, built once. */
let shared: { front: THREE.CanvasTexture; side: THREE.CanvasTexture; back: THREE.CanvasTexture; legSide: THREE.CanvasTexture } | null = null;
const coatTextures = new Map<number, { armSide: THREE.CanvasTexture; bodyFront: THREE.CanvasTexture }>();

function sharedTextures() {
  shared ??= {
    front: faceTexture((g) => {
      g.fillStyle = SKIN; g.fillRect(0, 0, 8, 8);
      g.fillStyle = HAIR; g.fillRect(0, 0, 8, 2); g.fillRect(0, 2, 1, 1); g.fillRect(7, 2, 2, 1);
      g.fillStyle = '#ffffff'; g.fillRect(1, 4, 2, 1); g.fillRect(5, 4, 2, 1);
      g.fillStyle = '#26215C'; g.fillRect(2, 4, 1, 1); g.fillRect(5, 4, 1, 1);
      g.fillStyle = '#993C1D'; g.fillRect(3, 6, 2, 1);
    }),
    side: faceTexture((g) => { g.fillStyle = SKIN; g.fillRect(0, 0, 8, 8); g.fillStyle = HAIR; g.fillRect(0, 0, 8, 3); }),
    back: faceTexture((g) => { g.fillStyle = HAIR; g.fillRect(0, 0, 8, 8); g.fillStyle = SKIN; g.fillRect(0, 6, 8, 2); }),
    legSide: canvasTex(4, 12, (g) => { g.fillStyle = PANTS; g.fillRect(0, 0, 4, 12); g.fillStyle = SHOE; g.fillRect(0, 10, 4, 2); }),
  };
  return shared;
}

function coatTexturesFor(coat: number) {
  let textures = coatTextures.get(coat);
  if (!textures) {
    const base = '#' + coat.toString(16).padStart(6, '0');
    const light = '#' + new THREE.Color(coat).lerp(new THREE.Color(0xffffff), 0.4).getHexString();
    textures = {
      armSide: canvasTex(4, 12, (g) => { g.fillStyle = base; g.fillRect(0, 0, 4, 12); g.fillStyle = SKIN; g.fillRect(0, 9, 4, 3); }),
      bodyFront: canvasTex(8, 12, (g) => { g.fillStyle = base; g.fillRect(0, 0, 8, 12); g.fillStyle = light; g.fillRect(3, 0, 2, 12); }),
    };
    coatTextures.set(coat, textures);
  }
  return textures;
}

export interface Character {
  root: THREE.Group;
  setPose(pose: NpcPose): void;
  /** Fades the whole figure; 1 is opaque. */
  setOpacity(opacity: number): void;
  /** Releases the materials; the textures are shared. */
  dispose(): void;
}

export type MaterialSet = 'head' | 'body' | 'arm' | 'leg';

/** What of an `NpcPose` turns a part, and which way. */
interface Motion {
  limb: keyof NpcPose;
  sign: 1 | -1;
}

export interface CharacterPart {
  /** Width, height and depth in figure units. */
  size: readonly [number, number, number];
  /** The joint the part turns about, in figure units: x and y, with z always 0. */
  joint: readonly [number, number];
  /** Height of the part's middle above its joint. */
  centre: number;
  materials: MaterialSet;
  /** The pose angle that turns the part; the head about y, the limbs about x. Null stays put. */
  motion: Motion | null;
}

/** The six boxes of the figure, shared by the single character and the instanced crowd. */
export const CHARACTER_PARTS: readonly CharacterPart[] = [
  { size: [8, 8, 8], joint: [0, 24], centre: 4, materials: 'head', motion: { limb: 'head', sign: 1 } },
  { size: [8, 12, 4], joint: [0, 18], centre: 0, materials: 'body', motion: null },
  { size: [4, 12, 4], joint: [-6, 22], centre: -4, materials: 'arm', motion: { limb: 'arm', sign: 1 } },
  { size: [4, 12, 4], joint: [6, 22], centre: -4, materials: 'arm', motion: { limb: 'arm', sign: -1 } },
  { size: [4, 12, 4], joint: [-2, 12], centre: -6, materials: 'leg', motion: { limb: 'leg', sign: 1 } },
  { size: [4, 12, 4], joint: [2, 12], centre: -6, materials: 'leg', motion: { limb: 'leg', sign: -1 } },
];

/** The faces of each kind of part, with the coat's colour on the body and arms. Fresh every call. */
export function characterMaterials(coat: number): Record<MaterialSet, THREE.Material[]> {
  const { front, side, back, legSide } = sharedTextures();
  const { armSide, bodyFront } = coatTexturesFor(coat);
  const textured = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });
  return {
    head: [textured(side), textured(side), solid(HAIR), solid(SKIN), textured(front), textured(back)],
    arm: [textured(armSide), textured(armSide), solid(coat), solid(SKIN), textured(armSide), textured(armSide)],
    leg: [textured(legSide), textured(legSide), solid(PANTS), solid(SHOE), textured(legSide), textured(legSide)],
    body: [solid(coat), solid(coat), solid(coat), solid(coat), textured(bodyFront), solid(coat)],
  };
}

/**
 * The blocky character of the pivot demo: six boxes, with the head, arms and legs each turning about
 * a joint of their own. `coat` colours the body and arms so residents can be told apart.
 */
export function createCharacter(coat: number): Character {
  const sets = characterMaterials(coat);
  const materials = Object.values(sets).flat();

  const root = new THREE.Group();
  const pivots = CHARACTER_PARTS.map((part) => {
    const pivot = new THREE.Group();
    pivot.position.set(part.joint[0], part.joint[1], 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...part.size), sets[part.materials]);
    mesh.position.y = part.centre;
    pivot.add(mesh);
    root.add(pivot);
    return pivot;
  });

  return {
    root,
    setPose(pose) {
      CHARACTER_PARTS.forEach(({ motion }, index) => {
        if (!motion) return;
        const turn = motion.sign * pose[motion.limb];
        if (motion.limb === 'head') pivots[index]!.rotation.y = turn;
        else pivots[index]!.rotation.x = turn;
      });
    },
    setOpacity(opacity) {
      for (const material of materials) {
        material.transparent = opacity < 1;
        material.opacity = opacity;
      }
    },
    dispose() {
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      for (const material of materials) material.dispose();
    },
  };
}
