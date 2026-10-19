import { useEffect, type MutableRefObject, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import type { EffectComposer } from 'postprocessing';

/** Re-renders the current view at screenshot resolution and resolves to a PNG. */
export type SceneCapture = () => Promise<Blob>;

/** Long edge of exported screenshots in pixels; touch devices stop lower to keep GPU memory in check. */
export const SCREENSHOT_LONG_EDGE = 3840;
export const TOUCH_SCREENSHOT_LONG_EDGE = 2560;

interface SceneCaptureBridgeProps {
  captureRef: MutableRefObject<SceneCapture | null>;
  /** Mounted only in VIEW mode; without it the scene renders straight to the canvas. */
  composerRef: RefObject<EffectComposer>;
  longEdge: number;
}

/**
 * Publishes the screenshot function. It raises the pixel ratio, renders one frame through the same pipeline as the
 * screen, copies the canvas and restores the screen resolution within one task, so nothing is painted in between.
 * Rendering into a separate render target instead would skip the composer (AO, tone mapping) and r160's sRGB output.
 */
export function SceneCaptureBridge({ captureRef, composerRef, longEdge }: SceneCaptureBridgeProps) {
  const get = useThree(state => state.get);
  useEffect(() => {
    captureRef.current = async () => {
      const { gl, scene, camera, size, invalidate } = get();
      if (!size.width || !size.height) throw new Error('畫面尚未就緒');
      const composer = composerRef.current;
      const screenRatio = gl.getPixelRatio();
      const autoClear = gl.autoClear;
      const edge = Math.min(longEdge, gl.capabilities.maxTextureSize);
      const copy = document.createElement('canvas');
      try {
        gl.setPixelRatio(Math.max(screenRatio, edge / Math.max(size.width, size.height)));
        // The composer only follows CSS size changes; its buffers must follow the new pixel ratio too.
        composer?.setSize(size.width, size.height);
        gl.autoClear = true;
        if (composer) composer.render();
        else gl.render(scene, camera);
        copy.width = gl.domElement.width;
        copy.height = gl.domElement.height;
        const context = copy.getContext('2d');
        if (!context) throw new Error('無法建立截圖畫布');
        context.drawImage(gl.domElement, 0, 0);
      } finally {
        gl.autoClear = autoClear;
        gl.setPixelRatio(screenRatio);
        composer?.setSize(size.width, size.height);
        invalidate();
      }
      return new Promise<Blob>((resolve, reject) => {
        copy.toBlob(blob => (blob ? resolve(blob) : reject(new Error('PNG 輸出失敗'))), 'image/png');
      });
    };
    return () => { captureRef.current = null; };
  }, [captureRef, composerRef, get, longEdge]);
  return null;
}
