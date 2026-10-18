import React, { useEffect, useRef } from 'react';
import * as skinview3d from 'skinview3d';

export type SkinAnimationType = 'idle' | 'walk' | 'run' | 'fly' | 'none';

interface SkinViewer3DProps {
  skinUrl: string;
  capeUrl?: string | null;
  variant: 'classic' | 'slim';
  animation?: SkinAnimationType;
  showOuterLayer?: boolean;
  width?: number;
  height?: number;
  autoRotate?: boolean;
}

// Generate a valid 64x64 Minecraft skin data URL in case external URL is offline/blocked
export function generateProceduralSkinDataUrl(primaryColor = '#4f46e5', accentColor = '#38bdf8'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, 64, 64);

  // Head (8x8x8 at 0,0)
  ctx.fillStyle = '#f1c27d'; // Skin tone
  ctx.fillRect(0, 0, 32, 16);

  // Hair / Visor
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(8, 0, 8, 8); // Top head
  ctx.fillRect(8, 8, 8, 3); // Forehead hair
  ctx.fillRect(0, 8, 8, 8); // Right side
  ctx.fillRect(16, 8, 8, 8); // Left side
  ctx.fillRect(24, 8, 8, 8); // Back head

  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(9, 12, 2, 1);
  ctx.fillRect(13, 12, 2, 1);
  ctx.fillStyle = accentColor;
  ctx.fillRect(10, 12, 1, 1);
  ctx.fillRect(13, 12, 1, 1);

  // Torso (8x12x4 at 16,16)
  ctx.fillStyle = primaryColor;
  ctx.fillRect(16, 16, 24, 16);
  // Chest neon emblem
  ctx.fillStyle = accentColor;
  ctx.fillRect(22, 22, 4, 4);

  // Right Leg (4x12x4 at 0,16) & Left Leg (at 16,48)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 16, 16, 16);
  ctx.fillRect(16, 48, 16, 16);

  // Shoes
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 30, 16, 2);
  ctx.fillRect(16, 62, 16, 2);

  // Right Arm (at 40,16) & Left Arm (at 32,48)
  ctx.fillStyle = primaryColor;
  ctx.fillRect(40, 16, 16, 12);
  ctx.fillRect(32, 48, 16, 12);
  // Hands
  ctx.fillStyle = '#f1c27d';
  ctx.fillRect(40, 28, 16, 4);
  ctx.fillRect(32, 60, 16, 4);

  return canvas.toDataURL('image/png');
}

export const SkinViewer3D: React.FC<SkinViewer3DProps> = ({
  skinUrl,
  capeUrl,
  variant = 'classic',
  animation = 'idle',
  showOuterLayer = true,
  width = 300,
  height = 410,
  autoRotate = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<skinview3d.SkinViewer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const fallbackSkin = generateProceduralSkinDataUrl();

    const viewer = new skinview3d.SkinViewer({
      canvas: canvasRef.current,
      width,
      height,
      skin: fallbackSkin,
    });

    viewer.fov = 50;
    viewer.zoom = 0.86;
    viewer.autoRotate = autoRotate;
    viewer.autoRotateSpeed = 0.6;

    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, []);

  // Update dimensions
  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.width = width;
      viewerRef.current.height = height;
    }
  }, [width, height]);

  // Update skin & model variant
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const modelType = variant === 'slim' ? 'slim' : 'default';
    const targetUrl = skinUrl || generateProceduralSkinDataUrl();

    viewer.loadSkin(targetUrl, { model: modelType }).catch(() => {
      viewer.loadSkin(generateProceduralSkinDataUrl(), { model: modelType });
    });
  }, [skinUrl, variant]);

  // Update cape
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (capeUrl) {
      viewer.loadCape(capeUrl).catch(() => viewer.loadCape(null));
    } else {
      viewer.loadCape(null);
    }
  }, [capeUrl]);

  // Update animation
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (animation === 'idle') {
      viewer.animation = new skinview3d.IdleAnimation();
    } else if (animation === 'walk') {
      viewer.animation = new skinview3d.WalkingAnimation();
    } else if (animation === 'run') {
      viewer.animation = new skinview3d.RunningAnimation();
    } else if (animation === 'fly') {
      viewer.animation = new skinview3d.FlyingAnimation();
    } else {
      viewer.animation = null;
    }
  }, [animation]);

  // Update autoRotate & outer layer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.autoRotate = autoRotate;

    const skinObj = viewer.playerObject.skin;
    skinObj.head.outerLayer.visible = showOuterLayer;
    skinObj.body.outerLayer.visible = showOuterLayer;
    skinObj.leftArm.outerLayer.visible = showOuterLayer;
    skinObj.rightArm.outerLayer.visible = showOuterLayer;
    skinObj.leftLeg.outerLayer.visible = showOuterLayer;
    skinObj.rightLeg.outerLayer.visible = showOuterLayer;
  }, [autoRotate, showOuterLayer]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
      }}
      title="Glisser pour pivoter le modèle 3D • Molette pour zoomer"
    >
      <canvas ref={canvasRef} />
    </div>
  );
};
