import * as THREE from 'three';
import type { AgentState } from './agentMood';
import { PALETTE } from './sceneKit';

/**
 * The floating robot an agent's resident is drawn as, from `demos/floating_ai_agent_movement.html`:
 * a boxy body and head with a screen face, hovering on thrust rings, with hands that move on their
 * own. Sized in the demo's units; scale `root` to put it on the map.
 */
export const ROBOT_HOVER = 5;
/** Height of the antenna's tip above the resting root, in robot units. */
export const ROBOT_TOP = ROBOT_HOVER + 9;

const SHELL = 0xe8e5f3;
const SHELL_SHADE = 0xc9c4e0;
const DARK = 0x1a1430;
const FACE_W = 40;
const FACE_H = 26;
const HAPPY_GOLD = 0xffc24a;

export interface RobotFrame {
  /** Seconds on a steady clock, and seconds since the last frame. */
  time: number;
  dt: number;
  state: AgentState;
  /** Whether the resident is on its way somewhere. */
  moving: boolean;
  /** The way it faces, as `Math.atan2(dx, dz)` of its walk. */
  heading: number;
}

export interface AgentRobot {
  root: THREE.Group;
  /** Moves the robot to its pose for this frame. */
  update(frame: RobotFrame): void;
  /** How far the robot is above its resting hover, in robot units, for the shadow. */
  lift(): number;
  /** Fades the whole robot; 1 is opaque. */
  setOpacity(opacity: number): void;
  dispose(): void;
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const turnBetween = (from: number, to: number) => {
  let turn = to - from;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  return turn;
};

export function createAgentRobot(coat: number): AgentRobot {
  const materials: THREE.Material[] = [];
  const track = <T extends THREE.Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const lit = (color: number) => track(new THREE.MeshLambertMaterial({ color }));
  const neon = (color: number) => track(new THREE.MeshBasicMaterial({ color }));
  const shell = lit(SHELL);
  const shade = lit(SHELL_SHADE);
  const accent = lit(coat);
  const dark = lit(DARK);
  const cyan = neon(PALETTE.cyan);
  const pink = neon(PALETTE.pink);

  const box = (parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const group = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const made = new THREE.Group();
    made.position.set(x, y, z);
    parent.add(made);
    return made;
  };
  const ring = (radius: number, tube: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 4, 8), material);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };

  const root = new THREE.Group();
  const agent = group(root, 0, ROBOT_HOVER, 0);
  agent.rotation.order = 'YXZ';

  const body = group(agent, 0, 0, 0);
  box(body, 3.8, 2.6, 3.2, shell, 0, 0, 0);
  box(body, 3.2, 0.5, 2.6, shade, 0, -1.5, 0);
  box(body, 3.9, 0.3, 3.3, accent, 0, 0.9, 0);
  box(body, 1.6, 1.4, 0.2, dark, 0, -0.1, 1.65);
  const core = box(body, 1, 0.9, 0.25, cyan, 0, -0.1, 1.72);
  const neck = ring(1.1, 0.12, pink);
  neck.position.y = 1.55;
  body.add(neck);

  const head = group(agent, 0, 4.4, 0);
  box(head, 6, 4.6, 4.8, shell, 0, 0, 0);
  box(head, 6.1, 0.5, 4.9, shade, 0, 2.25, 0);
  box(head, 6.1, 0.35, 4.9, accent, 0, -2.05, 0);
  box(head, 5.2, 3.4, 0.3, dark, 0, 0.1, 2.4);
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = FACE_W;
  faceCanvas.height = FACE_H;
  const face = faceCanvas.getContext('2d')!;
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.magFilter = THREE.NearestFilter;
  faceTexture.minFilter = THREE.NearestFilter;
  box(head, 4.7, 3, 0.05, track(new THREE.MeshBasicMaterial({ map: faceTexture })), 0, 0.1, 2.56);
  for (const side of [-1, 1]) {
    const ear = group(head, side * 3.15, 0.2, 0);
    box(ear, 0.5, 1.8, 1.8, accent, 0, 0, 0);
    const earRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.1, 4, 8), cyan);
    earRing.rotation.y = Math.PI / 2;
    earRing.position.x = side * 0.27;
    ear.add(earRing);
  }
  const antenna = group(head, 1.6, 2.4, -0.6);
  box(antenna, 0.3, 1.6, 0.3, dark, 0, 0.8, 0);
  const tipMaterial = neon(PALETTE.pink);
  box(antenna, 0.6, 0.6, 0.6, tipMaterial, 0, 1.8, 0);

  const hands = [-1, 1].map((side) => {
    const hand = group(agent, side * 3.6, 0.2, 0.4);
    box(hand, 1.2, 1.2, 1.2, shell, 0, 0, 0);
    box(hand, 1.25, 0.3, 1.25, accent, 0, 0.45, 0);
    box(hand, 0.5, 0.15, 0.5, cyan, 0, -0.62, 0);
    return hand;
  });

  const thrust = group(agent, 0, -1.9, 0);
  const thrustRing = ring(1.6, 0.14, cyan);
  const thrustRing2 = ring(1, 0.1, pink);
  thrustRing2.position.y = -0.9;
  thrust.add(thrustRing, thrustRing2);
  const beamMaterial = track(new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.6, 6, 8, 1, true), beamMaterial);
  beam.position.y = -3.2;
  thrust.add(beam);

  // The bits that circle the head while thinking, and rise around it when happy.
  const gold = neon(HAPPY_GOLD);
  const orbit = group(head, 0, 0, 0);
  const bits = Array.from({ length: 6 }, (_, index) => box(orbit, 0.55, 0.55, 0.55, index % 2 ? cyan : pink, 0, 0, 0));
  orbit.visible = false;

  let blinkIn = 2.5 + Math.random() * 2;
  let blink = 0;
  let sk = 0;
  let lean = 0;
  let bank = 0;
  let lastHeading: number | null = null;
  let heading = 0;
  let lift = 0;
  let drawnFace = '';
  let opacity = 1;

  const eye = (x: number, y: number, w: number, h: number, color: string) => {
    face.fillStyle = color;
    face.fillRect(x, y, w, h);
    face.fillStyle = 'rgba(255,255,255,0.85)';
    if (h > 2 && w > 2) face.fillRect(x, y, 1, 1);
  };
  const drawFace = (state: AgentState, t: number, moving: boolean, blinking: boolean) => {
    // Only the moving faces change between frames; the rest are redrawn when they differ.
    const frame = state === 'think' ? Math.floor(t * 3) : state === 'talk' ? Math.floor(t * 20) : 0;
    const key = `${state}:${moving}:${blinking}:${frame}`;
    if (key === drawnFace) return;
    drawnFace = key;
    const C = '#22e5f0';
    const P = '#e05bf0';
    face.fillStyle = '#0b0816';
    face.fillRect(0, 0, FACE_W, FACE_H);
    face.fillStyle = '#120f26';
    for (let y = 0; y < FACE_H; y += 2) face.fillRect(0, y, FACE_W, 1);
    if (state === 'happy') {
      for (const x of [10, 24]) {
        face.fillStyle = C;
        face.fillRect(x, 10, 2, 2);
        face.fillRect(x + 2, 8, 2, 2);
        face.fillRect(x + 4, 10, 2, 2);
      }
      face.fillStyle = P;
      face.fillRect(7, 15, 3, 1);
      face.fillRect(30, 15, 3, 1);
      face.fillStyle = C;
      face.fillRect(17, 16, 6, 1);
      face.fillRect(16, 15, 1, 1);
      face.fillRect(23, 15, 1, 1);
    } else if (state === 'think') {
      eye(11, 5, 4, 5, C);
      eye(25, 5, 4, 5, C);
      for (let i = 0; i < 3; i++) {
        face.fillStyle = i < frame % 4 ? P : '#2c2348';
        face.fillRect(15 + i * 4, 17, 2, 2);
      }
    } else {
      const height = blinking ? 1 : moving ? 5 : 7;
      const top = blinking ? 11 : moving ? 9 : 8;
      eye(11, top, 4, height, C);
      eye(25, top, 4, height, C);
      if (moving && !blinking) {
        face.fillStyle = '#0b0816';
        face.fillRect(11, top, 4, 1);
        face.fillRect(25, top, 4, 1);
      }
      if (state === 'talk') {
        for (let i = 0; i < 7; i++) {
          const h = 1 + Math.round(Math.abs(Math.sin(t * 14 + i * 1.3) * Math.sin(t * 5 + i)) * 4);
          face.fillStyle = i % 3 === 1 ? P : C;
          face.fillRect(13 + i * 2, 20 - h, 1, h * 2 - 1);
        }
      } else if (moving) {
        face.fillStyle = C;
        face.fillRect(19, 19, 2, 2);
      } else {
        face.fillStyle = C;
        face.fillRect(18, 19, 4, 1);
      }
    }
    faceTexture.needsUpdate = true;
  };

  function update({ time: t, dt, state, moving, heading: facing }: RobotFrame): void {
    blinkIn -= dt;
    if (blinkIn <= 0) {
      blink = 0.12;
      blinkIn = 2 + Math.random() * 3;
    }
    blink = Math.max(0, blink - dt);

    sk += ((moving ? 1 : 0) - sk) * Math.min(1, dt * 4);
    const turn = lastHeading === null || dt <= 0 ? 0 : turnBetween(lastHeading, facing) / dt;
    lastHeading = facing;
    heading += turnBetween(heading, facing) * Math.min(1, dt * 8);
    lean += (sk * 0.32 - lean) * Math.min(1, dt * 5);
    bank += (clamp(-turn * 0.12, -0.35, 0.35) - bank) * Math.min(1, dt * 5);

    const happy = state === 'happy';
    const amp = happy ? 1 : 0.6;
    const spd = happy ? 3.2 : 1.6;
    lift = Math.sin(t * spd) * amp * (1 - sk * 0.6) + (happy ? Math.abs(Math.sin(t * 6)) * 0.6 : 0) - sk * 0.6;
    agent.position.y = ROBOT_HOVER + lift;
    agent.rotation.y = heading + (happy ? Math.sin(t * 4) * 0.15 : 0);
    agent.rotation.x = lean;
    agent.rotation.z = bank + Math.sin(t * 1.1) * 0.05 * (1 - sk);
    head.rotation.x = (state === 'think' ? -0.12 : 0) - lean * 0.5;
    head.rotation.z = state === 'think' ? Math.sin(t * 1.5) * 0.1 + 0.08 : 0;
    head.position.y = 4.4 + Math.sin(t * spd - 0.6) * 0.15;
    antenna.rotation.x = -lean * 1.6 + Math.sin(t * 9) * 0.05 * sk;
    antenna.rotation.z = -bank * 1.5;

    hands.forEach((hand, index) => {
      const side = index ? 1 : -1;
      let y = 0.2 + Math.sin(t * spd + index * 1.5) * 0.35;
      let x = side * 3.6;
      let z = 0.4;
      let rx = 0;
      if (state === 'talk') {
        y += Math.sin(t * 5 + index * 2) * 0.5;
        z = 1.2 + Math.sin(t * 4 + index) * 0.4;
        rx = Math.sin(t * 5 + index) * 0.4;
      }
      if (state === 'think' && index === 1) {
        x = 1.6;
        y = 2.4;
        z = 2.2;
      }
      if (happy) {
        y = 1.6 + Math.abs(Math.sin(t * 6 + index * Math.PI)) * 0.8;
        x = side * (3.8 + Math.sin(t * 6) * 0.3);
      }
      z -= sk * 2.2;
      y += sk * 0.6;
      x += side * sk * 0.4;
      const follow = Math.min(1, dt * (6 - sk * 2));
      hand.position.x += (x - hand.position.x) * follow;
      hand.position.y += (y - hand.position.y) * follow;
      hand.position.z += (z - hand.position.z) * follow;
      hand.rotation.x = rx - sk * 0.5;
      hand.rotation.y += dt * (happy ? 3 : 0.6 + sk * 4);
    });

    thrust.rotation.x = -lean * 1.4;
    beam.scale.set(1, 1 + sk * 0.5, 1);
    beamMaterial.opacity = (0.09 + 0.05 * Math.sin(t * 6) + sk * 0.1) * opacity;
    thrustRing.rotation.z += dt * (1.5 + sk * 8);
    thrustRing2.rotation.z -= dt * (2.5 + sk * 10);
    neck.rotation.z += dt * 1.2;

    orbit.visible = state === 'think' || happy;
    if (orbit.visible) {
      orbit.rotation.y += dt * (happy ? 4 : 2.2);
      bits.forEach((bit, index) => {
        const angle = (index / bits.length) * Math.PI * 2;
        const radius = happy ? 5.4 : 4.6;
        const rise = happy ? 1.5 + ((t * 2 + index / bits.length) % 1) * 4 : 3 + Math.sin(t * 3 + index) * 0.4;
        bit.position.set(Math.cos(angle) * radius, rise, Math.sin(angle) * radius);
        bit.rotation.x += dt * 2;
        bit.rotation.y += dt * 3;
        bit.material = happy ? gold : index % 2 ? cyan : pink;
      });
    }

    const pulse = state === 'think' ? 0.5 + 0.5 * Math.sin(t * 8) : state === 'talk' ? 0.6 + 0.4 * Math.abs(Math.sin(t * 12)) : 0.7 + 0.3 * Math.sin(t * 2.5);
    core.scale.set(0.8 + pulse * 0.25, 0.8 + pulse * 0.25, 1);
    tipMaterial.color.setHSL(state === 'think' ? (t * 0.5) % 1 : 0.83, 0.85, 0.45 + 0.25 * Math.sin(t * (state === 'think' ? 10 : 3)));

    drawFace(state, t, sk > 0.4, blink > 0 && state !== 'happy' && state !== 'think');
  }

  drawFace('idle', 0, false, false);

  return {
    root,
    update,
    lift: () => lift,
    setOpacity(next) {
      opacity = next;
      for (const material of materials) {
        material.transparent = next < 1 || material === beamMaterial;
        if (material !== beamMaterial) material.opacity = next;
      }
    },
    dispose() {
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      faceTexture.dispose();
    },
  };
}
