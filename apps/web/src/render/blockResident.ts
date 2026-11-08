import * as Phaser from 'phaser';

export interface BlockResident {
  parts: Phaser.GameObjects.GameObject[];
  leftArm: Phaser.GameObjects.Graphics;
  rightArm: Phaser.GameObjects.Graphics;
  leftLeg: Phaser.GameObjects.Graphics;
  rightLeg: Phaser.GameObjects.Graphics;
}

/** A tiny cuboid resident. Limbs pivot only a few degrees while walking. */
export function createBlockResident(scene: Phaser.Scene, color: string): BlockResident {
  const tint = Phaser.Display.Color.HexStringToColor(color).color;
  const piece = (x: number, y: number, width: number, height: number, fill: number) => {
    const graphic = scene.add.graphics();
    graphic.fillStyle(fill);
    graphic.fillRect(0, 0, width, height);
    graphic.lineStyle(1, 0x182332, 0.9);
    graphic.strokeRect(0, 0, width, height);
    graphic.setPosition(x, y);
    return graphic;
  };
  const leftLeg = piece(-9, -12, 7, 12, 0x25334c);
  const rightLeg = piece(2, -12, 7, 12, 0x34425c);
  const leftArm = piece(-15, -29, 6, 16, tint);
  const rightArm = piece(9, -29, 6, 16, tint);
  const body = piece(-10, -29, 20, 19, tint);
  const chest = piece(-6, -25, 12, 7, 0x90e4e7);
  const head = piece(-9, -46, 18, 17, 0xf1ca9f);
  const hair = piece(-10, -47, 20, 5, 0x26344b);
  const eyeLeft = piece(-5, -37, 2, 2, 0x233449);
  const eyeRight = piece(4, -37, 2, 2, 0x233449);
  return { parts: [leftLeg, rightLeg, leftArm, rightArm, body, chest, head, hair, eyeLeft, eyeRight], leftArm, rightArm, leftLeg, rightLeg };
}
