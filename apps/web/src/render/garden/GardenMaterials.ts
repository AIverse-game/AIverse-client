import * as THREE from 'three';
import { canvasTex, seeded } from '../sceneKit';
import {
  FIREFLY_COLOR, FIREFLY_OPACITY, FIXED_COLORS, GRASS_REPEAT, GRASS_SHADES, GRASS_TEXTURE_SIZE, LANTERN_DAY, LANTERN_NIGHT,
  NIGHT_TINT, POOL_COLOR, POOL_OPACITY, seasonColors, SEASON_NAMES, type SeasonName,
} from './gardenPalette';

/** Materials that sway in the wind: the plants. Their vertices carry `aSway`, see `GardenMaterials.swaying`. */
const SWAY_ROLES = ['stem', 'white', 'yellow', 'wood2', 'leaf', 'lavender', 'bed0', 'bed1', 'bed2', 'bed3', 'bed4', 'wisteria0', 'wisteria1', 'wisteria2'];

const channel = (color: number, shift: number) => ((color >> shift) & 255) / 255;
const mix = (a: number, b: number, share: number) => a + (b - a) * share;

/** Colour of the water's pixels. */
const WATER_BLUES = ['#5aa6d6', '#4a96c8', '#7cbde4', '#a8d6f0'];

/**
 * Every material the gardens use, shared by all of them so that one change recolours every garden on
 * the map: `setSeason` gives the seasonal roles their colours and `setDaylight` dims the lit ones and
 * lights the lanterns and fireflies. Neither touches a model; a model is built once and asks for its
 * materials by role (`lit`). The garden is lit by the map's own lights, which are fixed, so a lit
 * material's colour is its base colour times the night tint.
 */
export class GardenMaterials {
  /** Shared by the wind's vertex shader; `update` moves it on. */
  readonly swayTime = { value: 0 };
  /** The lantern windows, which light up at dusk. */
  readonly lantern = new THREE.MeshBasicMaterial({ color: LANTERN_DAY });
  /** Always lit: the thin rim of light under a garden's slab. */
  readonly rim = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  /** The soft pool of light a lantern throws on the ground, added to what is there. */
  readonly pool = new THREE.MeshBasicMaterial({
    color: POOL_COLOR, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  /** The fireflies, who are out at night. */
  readonly firefly = new THREE.MeshBasicMaterial({ color: FIREFLY_COLOR, transparent: true, opacity: 0 });
  private readonly roles = new Map<string, { material: THREE.MeshLambertMaterial; base: number }>();
  private readonly swaying = new Set<THREE.Material>();
  private readonly owned: Array<{ dispose(): void }> = [];
  private waterMap: THREE.CanvasTexture | null = null;
  private season: SeasonName = SEASON_NAMES[0]!;
  private night = 0;

  constructor() {
    const textured = typeof document !== 'undefined';
    const water = textured ? this.makeWaterTexture() : null;
    const grass = textured ? this.makeGrassTexture() : null;
    this.waterMap = water;
    if (textured) this.pool.map = this.makeGlowTexture();
    for (const [role, color] of Object.entries(FIXED_COLORS)) this.add(role, color);
    this.add('water', 0xffffff, { map: water, transparent: true, opacity: 0.9 });
    this.add('pondWater', 0xffffff, { map: water, transparent: true, opacity: 0.72 });
    for (const [role, color] of Object.entries(seasonColors(this.season))) {
      this.add(role, color, role === 'grass' ? { map: grass } : {});
    }
    for (const role of SWAY_ROLES) this.makeSway(this.lit(role));
    this.setSeason(this.season);
    this.setDaylight(1);
  }

  /** The lit material for a role: a fixed one such as `stone` or a seasonal one such as `canopy1`. */
  lit(role: string): THREE.MeshLambertMaterial {
    const found = this.roles.get(role);
    if (!found) throw new Error(`garden has no material for ${role}`);
    return found.material;
  }

  /** Whether the vertices drawn with `material` must carry `aSway`: zero where a part does not sway. */
  isSwaying(material: THREE.Material): boolean {
    return this.swaying.has(material);
  }

  setSeason(season: SeasonName): void {
    this.season = season;
    for (const [role, color] of Object.entries(seasonColors(season))) {
      const found = this.roles.get(role);
      if (found) found.base = color;
    }
    this.dim();
  }

  /** 1 in full daylight, 0 at night. */
  setDaylight(daylight: number): void {
    this.night = 1 - Math.min(Math.max(daylight, 0), 1);
    this.dim();
    const lantern = new THREE.Color(LANTERN_DAY).lerp(new THREE.Color(LANTERN_NIGHT), this.night);
    this.lantern.color.copy(lantern);
    this.pool.opacity = this.night * POOL_OPACITY;
    this.firefly.opacity = this.night * FIREFLY_OPACITY;
  }

  /** How dark it is, 0 to 1; models switch off what only shows at night when it is 0. */
  get darkness(): number {
    return this.night;
  }

  get currentSeason(): SeasonName {
    return this.season;
  }

  /** Moves the water and the wind on; call once a frame however many gardens there are. */
  update(time: number): void {
    this.swayTime.value = time;
    if (this.waterMap) {
      this.waterMap.offset.x = time * 0.04;
      this.waterMap.offset.y = time * 0.025;
    }
  }

  dispose(): void {
    for (const { material } of this.roles.values()) material.dispose();
    for (const material of [this.lantern, this.rim, this.pool, this.firefly]) material.dispose();
    for (const resource of this.owned) resource.dispose();
    this.roles.clear();
  }

  private add(role: string, base: number, parameters: THREE.MeshLambertMaterialParameters = {}): void {
    const material = new THREE.MeshLambertMaterial({ color: base, ...parameters });
    this.roles.set(role, { material, base });
  }

  private dim(): void {
    for (const { material, base } of this.roles.values()) {
      material.color.setRGB(
        channel(base, 16) * mix(1, NIGHT_TINT[0], this.night),
        channel(base, 8) * mix(1, NIGHT_TINT[1], this.night),
        channel(base, 0) * mix(1, NIGHT_TINT[2], this.night),
      );
    }
  }

  /** Bends a material's vertices with the wind: more the higher they are above where the plant stands, `aSway.y`. */
  private makeSway(material: THREE.MeshLambertMaterial): void {
    this.swaying.add(material);
    material.customProgramCacheKey = () => 'garden-sway';
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSwayTime = this.swayTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aSway;\nuniform float uSwayTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          transformed.x += sin(uSwayTime * 1.6 + aSway.x) * 0.07 * aSway.y;
          transformed.z += cos(uSwayTime * 1.2 + aSway.x) * 0.04 * aSway.y;`,
        );
    };
  }

  /** A round fade from white in the middle to black at the edge, which an additive material turns into a soft pool of light. */
  private makeGlowTexture(): THREE.CanvasTexture {
    const texture = canvasTex(64, 64, (g) => {
      const fade = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      fade.addColorStop(0, '#ffffff');
      fade.addColorStop(0.35, '#6a6a6a');
      fade.addColorStop(1, '#000000');
      g.fillStyle = fade;
      g.fillRect(0, 0, 64, 64);
    });
    texture.magFilter = texture.minFilter = THREE.LinearFilter;
    this.owned.push(texture);
    return texture;
  }

  private makeWaterTexture(): THREE.CanvasTexture {
    const random = seeded(5);
    const texture = canvasTex(16, 16, (g) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          g.fillStyle = WATER_BLUES[Math.floor(random() * WATER_BLUES.length)]!;
          g.fillRect(x, y, 1, 1);
        }
      }
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    this.owned.push(texture);
    return texture;
  }

  /** Pixels of three shades of grey: times the season's grass colour they make its three greens. */
  private makeGrassTexture(): THREE.CanvasTexture {
    const random = seeded(3);
    const texture = canvasTex(GRASS_TEXTURE_SIZE, GRASS_TEXTURE_SIZE, (g) => {
      for (let y = 0; y < GRASS_TEXTURE_SIZE; y++) {
        for (let x = 0; x < GRASS_TEXTURE_SIZE; x++) {
          g.fillStyle = GRASS_SHADES[Math.floor(random() * GRASS_SHADES.length)]!;
          g.fillRect(x, y, 1, 1);
        }
      }
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(GRASS_REPEAT, GRASS_REPEAT);
    this.owned.push(texture);
    return texture;
  }
}
