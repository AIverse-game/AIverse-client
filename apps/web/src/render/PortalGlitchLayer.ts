import * as THREE from 'three';
import { glitchFrame, glitchHash, GLITCH_SECONDS, GLITCH_STEP, SLICES, type GlitchColor } from './portalGlitch';
import { canvasTex } from './sceneKit';

/** The glitch's neon, the HUD's pink and cyan. */
const COLORS: Record<GlitchColor, number> = { pink: 0xff4fd8, cyan: 0x3df5ff, white: 0xffffff };
const NOISE_COLORS = ['#ff4fd8', '#3df5ff', '#ffffff', '#7f77dd'] as const;
/** Different blocks of pixel noise, one picked a step, so the noise flickers. */
const NOISE_PICTURES = 4;
const NOISE_PIXELS = 12;
/** Size of the noise block, in figure heights. */
const NOISE_SIZE = 0.55;
/** Above the figures, which they tear across. */
const RENDER_ORDER = 15;

interface Glitch {
  group: THREE.Group;
  age: number;
  seed: number;
  slices: THREE.Sprite[];
  noise: THREE.Sprite;
}

/**
 * The torn pink and cyan slices and pixel noise shown where a visitor goes into a portal and where it
 * comes out, after `glitchFrame`. The visitor's own flicker and its ghost are the visitor layer's; this
 * draws only what is laid over them.
 */
export class PortalGlitchLayer {
  private readonly root = new THREE.Group();
  private readonly glitches: Glitch[] = [];
  private readonly colors: Record<GlitchColor, THREE.SpriteMaterial>;
  private readonly noises: THREE.SpriteMaterial[];
  private readonly textures: THREE.Texture[] = [];
  private readonly right = new THREE.Vector3(1, 0, 0);

  /** `unit` is how tall a figure is drawn, in map units. */
  constructor(scene: THREE.Scene, private readonly unit: number) {
    scene.add(this.root);
    const material = (parameters: THREE.SpriteMaterialParameters) =>
      new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0.9, ...parameters });
    this.colors = {
      pink: material({ color: COLORS.pink }),
      cyan: material({ color: COLORS.cyan }),
      white: material({ color: COLORS.white }),
    };
    this.noises = Array.from({ length: NOISE_PICTURES }, (_, picture) => {
      const texture = canvasTex(NOISE_PIXELS, NOISE_PIXELS, (g) => {
        for (let y = 0; y < NOISE_PIXELS; y++) {
          for (let x = 0; x < NOISE_PIXELS; x++) {
            const roll = glitchHash(picture, y, x);
            if (roll < 0.45) continue;
            g.fillStyle = NOISE_COLORS[Math.floor(((roll - 0.45) / 0.55) * NOISE_COLORS.length)]!;
            g.fillRect(x, y, 1, 1);
          }
        }
      });
      this.textures.push(texture);
      return material({ map: texture, opacity: 0.75 });
    });
  }

  /** Starts a glitch on the floor at `at` for the visitor `seed`. */
  start(at: THREE.Vector3, seed: number): void {
    const group = new THREE.Group();
    group.position.copy(at);
    const sprite = (material: THREE.SpriteMaterial) => {
      const made = new THREE.Sprite(material);
      made.renderOrder = RENDER_ORDER;
      made.visible = false;
      group.add(made);
      return made;
    };
    const glitch: Glitch = {
      group,
      age: 0,
      seed,
      slices: Array.from({ length: SLICES }, () => sprite(this.colors.pink)),
      noise: sprite(this.noises[0]!),
    };
    glitch.noise.scale.setScalar(NOISE_SIZE * this.unit);
    this.root.add(group);
    this.glitches.push(glitch);
    this.place(glitch);
  }

  /** Moves every glitch on by `dt` seconds; `camera` says which way is sideways on screen. */
  update(dt: number, camera: THREE.Camera): void {
    if (!this.glitches.length) return;
    const e = camera.matrixWorld.elements;
    this.right.set(e[0]!, 0, e[2]!);
    if (this.right.lengthSq() < 1e-6) this.right.set(1, 0, 0);
    this.right.normalize();
    for (let i = this.glitches.length - 1; i >= 0; i--) {
      const glitch = this.glitches[i]!;
      glitch.age += dt;
      if (glitch.age >= GLITCH_SECONDS) {
        this.root.remove(glitch.group);
        this.glitches.splice(i, 1);
      } else {
        this.place(glitch);
      }
    }
  }

  dispose(): void {
    this.glitches.length = 0;
    this.root.removeFromParent();
    for (const material of [...Object.values(this.colors), ...this.noises]) material.dispose();
    for (const texture of this.textures) texture.dispose();
  }

  private place(glitch: Glitch): void {
    const frame = glitchFrame(glitch.age, glitch.seed);
    const { unit, right } = this;
    const at = (sprite: THREE.Sprite, sideways: number, up: number) => {
      sprite.position.set(right.x * sideways * unit, up * unit, right.z * sideways * unit);
    };
    glitch.slices.forEach((sprite, index) => {
      const slice = frame?.slices[index];
      sprite.visible = slice !== undefined;
      if (!slice) return;
      sprite.material = this.colors[slice.color];
      sprite.scale.set(slice.width * unit, slice.height * unit, 1);
      at(sprite, slice.offset, slice.y);
    });
    const noise = frame?.noise ?? null;
    glitch.noise.visible = noise !== null;
    if (noise) {
      const picture = glitchHash(glitch.seed, Math.floor(glitch.age / GLITCH_STEP), 7);
      glitch.noise.material = this.noises[Math.floor(picture * NOISE_PICTURES)]!;
      at(glitch.noise, noise.offset, noise.y);
    }
  }
}
