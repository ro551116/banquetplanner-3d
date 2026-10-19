import React, { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, createRoot, extend, useThree } from '@react-three/fiber';
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Image as ImageIcon, RotateCcw, X } from 'lucide-react';
import { TrussStructureConfig } from '../types';
import { formatTrussTitle, getTrussDimensions } from '../trussConfig';
import { TrussStructureModel } from './models/TrussStructure';
import { StudioReflections } from './SceneEnvironment';
import { SceneCaptureBridge, SCREENSHOT_LONG_EDGE, TOUCH_SCREENSHOT_LONG_EDGE, type SceneCapture } from './SceneCapture';
import { downloadBlob } from './FloorPlanModal';
import { safeFilename } from './TrussSheetContent';
import { TOUCH_POINTER_QUERY, useMediaQuery } from './ui/useMediaQuery';

interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

// Front-right and a little above; the truss front faces +z.
const DEFAULT_VIEW_DIRECTION = new THREE.Vector3(0.8, 0.42, 1).normalize();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const PERSON_HEIGHT_M = 1.7;
const PERSON_GAP_M = 0.7;
const FIT_MARGIN = 1.1;

/** Camera distance along `direction` (target → camera) at which every corner of `box` is inside the frustum. */
function fitDistance(box: THREE.Box3, center: THREE.Vector3, direction: THREE.Vector3, camera: THREE.PerspectiveCamera, aspect: number) {
  const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanHorizontal = tanVertical * aspect;
  const right = new THREE.Vector3().crossVectors(WORLD_UP, direction);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0); // looking straight down
  right.normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const corner = new THREE.Vector3();
  let distance = 0;
  for (let i = 0; i < 8; i += 1) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center);
    const towardCamera = corner.dot(direction);
    distance = Math.max(
      distance,
      towardCamera + Math.abs(corner.dot(right)) / tanHorizontal,
      towardCamera + Math.abs(corner.dot(up)) / tanVertical,
    );
  }
  return distance * FIT_MARGIN;
}

interface Framing {
  personX: number;
  personZ: number;
  floorSize: number;
}

/** Plain 170 cm figure next to the truss for scale. */
function ScaleFigure({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.72, 0]}>
        <capsuleGeometry args={[0.16, 1.12, 6, 16]} />
        <meshStandardMaterial color="#8b97a8" roughness={0.85} />
      </mesh>
      <mesh position={[0, PERSON_HEIGHT_M - 0.12, 0]}>
        <sphereGeometry args={[0.12, 20, 14]} />
        <meshStandardMaterial color="#8b97a8" roughness={0.85} />
      </mesh>
    </group>
  );
}

interface TrussPreviewSceneProps {
  config: TrussStructureConfig;
  schematic: boolean;
  resetToken: number;
  /** Called each time the camera has been fitted to the structure; the off-screen export waits for it. */
  onFramed?: () => void;
}

function TrussPreviewScene({ config, schematic, resetToken, onFramed }: TrussPreviewSceneProps) {
  const group = useRef<THREE.Group>(null);
  const onFramedRef = useRef(onFramed);
  onFramedRef.current = onFramed;
  const camera = useThree(state => state.camera);
  const controls = useThree(state => state.controls);
  const aspect = useThree(state => state.size.width / Math.max(1, state.size.height));
  const invalidate = useThree(state => state.invalidate);
  const [framing, setFraming] = useState<Framing | null>(null);
  const fittedReset = useRef<number | null>(null);
  const dims = getTrussDimensions(config);
  const sizeKey = `${config.kind}:${dims.widthCm}:${dims.heightCm}:${dims.depthCm ?? ''}`;

  // Refit whenever the outer size changes; keep the user's orbit direction unless this is the first fit or a reset.
  useLayoutEffect(() => {
    if (!group.current || !controls || !(camera instanceof THREE.PerspectiveCamera)) return;
    const box = new THREE.Box3().setFromObject(group.current);
    if (box.isEmpty()) return;
    // The figure stands at the front-right corner, the side the default view looks from, so legs never hide it.
    const personX = box.max.x + PERSON_GAP_M;
    const personZ = box.max.z;
    box.expandByPoint(new THREE.Vector3(personX + 0.2, PERSON_HEIGHT_M, personZ + 0.2));
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const orbit = controls as unknown as OrbitControlsLike;
    const direction = fittedReset.current === resetToken
      ? camera.position.clone().sub(orbit.target).normalize()
      : DEFAULT_VIEW_DIRECTION.clone();
    fittedReset.current = resetToken;
    const distance = fitDistance(box, center, direction, camera, aspect);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 30;
    camera.updateProjectionMatrix();
    orbit.target.copy(center);
    orbit.update();
    setFraming({ personX, personZ, floorSize: Math.ceil(radius * 4) });
    invalidate();
    onFramedRef.current?.();
    // aspect is read but not a dependency: resizing the panel alone keeps the user's view.
  }, [sizeKey, controls, camera, resetToken, invalidate]);

  return (
    <>
      <color attach="background" args={['#eef1f5']} />
      <StudioReflections night={false} />
      <hemisphereLight args={['#ffffff', '#cbd2dc', 0.8]} />
      <directionalLight position={[6, 10, 8]} intensity={1.4} />
      <group ref={group}>
        <TrussStructureModel config={config} selected={false} schematicColors={schematic} />
      </group>
      {framing && (
        <>
          <ScaleFigure x={framing.personX} z={framing.personZ} />
          <ContactShadows position={[0, 0.002, 0]} scale={framing.floorSize} resolution={1024} far={6} blur={2.2} opacity={0.42} />
        </>
      )}
      <Grid
        infiniteGrid
        position={[0, 0.001, 0]}
        cellSize={0.5} cellThickness={0.5} cellColor="#c3c9d2"
        sectionSize={1} sectionThickness={0.9} sectionColor="#94a0b0"
        fadeDistance={framing ? framing.floorSize * 2 : 40}
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={0.5} maxPolarAngle={Math.PI / 2 - 0.02} />
    </>
  );
}

interface TrussPreview3DProps {
  config: TrussStructureConfig;
  className?: string;
  /** PNG name for 截圖; defaults to the structure title. */
  filename?: string;
}

/** Orbitable 3D view of one truss structure with a 1 m floor grid and a 170 cm figure for scale. */
export function TrussPreview3D({ config, className = '', filename }: TrussPreview3DProps) {
  const [schematic, setSchematic] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [capture, setCapture] = useState<'idle' | 'busy' | 'failed'>('idle');
  const captureRef = useRef<SceneCapture | null>(null);
  const touch = useMediaQuery(TOUCH_POINTER_QUERY);

  // Same capture as the scene's 截圖: the current view re-rendered at 3840 px on the long edge (2560 px on touch).
  const takeScreenshot = async () => {
    const run = captureRef.current;
    if (!run) return;
    setCapture('busy');
    try {
      downloadBlob(await run(), filename ?? `${safeFilename(formatTrussTitle(config))}-3D.png`);
      setCapture('idle');
    } catch (error) {
      console.error('Truss 3D screenshot failed:', error);
      setCapture('failed');
    }
  };

  return (
    <div className={`relative bg-[#eef1f5] ${className}`}>
      <Canvas
        frameloop="demand"
        camera={{ fov: 40, position: [6, 4, 8] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        dpr={[1, 2]}
        aria-label={`${formatTrussTitle(config)} 3D 預覽`}
      >
        <TrussPreviewScene config={config} schematic={schematic} resetToken={resetToken} />
        <SceneCaptureBridge captureRef={captureRef} longEdge={touch ? TOUCH_SCREENSHOT_LONG_EDGE : SCREENSHOT_LONG_EDGE} />
      </Canvas>
      <div className="absolute right-2 top-2 flex items-center gap-2">
        <label className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-xs text-slate-700 shadow-sm">
          <input type="checkbox" checked={schematic} onChange={event => setSchematic(event.target.checked)} className="h-3.5 w-3.5 accent-blue-600" />
          段長色碼
        </label>
        <button
          type="button"
          onClick={takeScreenshot}
          disabled={capture === 'busy'}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-xs text-slate-700 shadow-sm hover:bg-white disabled:opacity-50"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          {capture === 'busy' ? '輸出中…' : '截圖'}
        </button>
        <button type="button" onClick={() => setResetToken(token => token + 1)} className="ui-icon-btn bg-white/90 shadow-sm" aria-label="重設視角" title="重設視角">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
      {capture === 'failed' && (
        <div role="alert" className="absolute right-2 top-12 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600 shadow-sm">
          截圖失敗，請再試一次。
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-500">
        拖曳旋轉・滾輪縮放・格線 1 m・人形高 170 cm
      </div>
    </div>
  );
}

interface Truss3DDialogProps {
  config: TrussStructureConfig;
  quantity?: number;
  filename?: string;
  onClose: () => void;
}

/** One shared viewer for the Truss 工作台 list, so the page never holds a WebGL context per card. */
export function Truss3DDialog({ config, quantity, filename, onClose }: Truss3DDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="truss-3d-title"
      // No backdrop click-to-close: an orbit drag released outside the panel would land there.
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
          <h3 id="truss-3d-title" className="min-w-0 truncate text-base font-semibold text-slate-900">
            {formatTrussTitle(config, quantity)}
          </h3>
          <button ref={closeButton} type="button" onClick={onClose} className="ui-icon-btn" aria-label="關閉">
            <X className="w-4 h-4" />
          </button>
        </div>
        <TrussPreview3D config={config} filename={filename} className="aspect-[4/3] sm:aspect-[16/9] max-h-[78vh]" />
      </div>
    </div>
  );
}

/**
 * Renders each structure's opening 3D view (16:9, same framing as the dialog) off-screen through one WebGL context
 * and hands the PNGs over in order. Used by Truss 工作台's 全部 PNG.
 */
export async function captureTruss3DViews(
  configs: TrussStructureConfig[],
  onImage: (png: Blob, index: number) => void | Promise<void>,
) {
  const longEdge = window.matchMedia(TOUCH_POINTER_QUERY).matches ? TOUCH_SCREENSHOT_LONG_EDGE : SCREENSHOT_LONG_EDGE;
  // <Canvas> registers the THREE elements itself; a bare root does not, and Truss 工作台 may have no <Canvas> yet.
  extend(THREE);
  const root = createRoot(document.createElement('canvas'));
  const captureRef: MutableRefObject<SceneCapture | null> = { current: null };
  root.configure({
    frameloop: 'demand',
    size: { width: 1280, height: 720, top: 0, left: 0 },
    dpr: 1,
    camera: { fov: 40, position: [6, 4, 8] },
    gl: { antialias: true, toneMapping: THREE.ACESFilmicToneMapping },
  });
  try {
    // Executor-form promises: the client targets ES2022, and Promise.withResolvers is missing before iOS 17.4.
    for (const [index, config] of configs.entries()) {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('3D 畫面逾時')), 10000);
        root.render(
          <>
            <TrussPreviewScene
              config={config}
              schematic={false}
              resetToken={index}
              onFramed={() => { window.clearTimeout(timer); resolve(); }}
            />
            <SceneCaptureBridge captureRef={captureRef} longEdge={longEdge} />
          </>,
        );
      });
      // Let one frame render so the contact shadow and the scale figure follow the new structure.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const capture = captureRef.current;
      if (!capture) throw new Error('3D 畫面尚未就緒');
      await onImage(await capture(), index);
    }
  } finally {
    root.unmount();
  }
}
