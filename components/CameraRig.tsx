import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PRESET_VIEWS } from '../constants';

interface CameraRigProps {
  viewIndex: number;
  mode: 'EDIT' | 'VIEW';
}

export function CameraRig({ viewIndex, mode }: CameraRigProps) {
  const { controls } = useThree();
  const isTransitioning = useRef(false);

  useEffect(() => {
    if (mode === 'VIEW') {
      isTransitioning.current = true;
      const timer = setTimeout(() => {
        isTransitioning.current = false;
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [viewIndex, mode]);

  useFrame((state, delta) => {
    if (mode !== 'VIEW' || !controls || !isTransitioning.current) return;

    const targetView = PRESET_VIEWS[viewIndex];
    if (targetView) {
      state.camera.position.lerp(targetView.pos, 4 * delta);
      const ctrl = controls as any;
      ctrl.target.lerp(targetView.target, 4 * delta);
      ctrl.update();
    }
  });

  return null;
}
