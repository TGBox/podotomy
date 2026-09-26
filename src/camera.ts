import * as THREE from 'three';
import { camera, controls } from './scene.js';
import { AppState } from './state.js';

export function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateCamera(endCamPos: THREE.Vector3, endTarget: THREE.Vector3, duration = 800): void {
    const startCamPos = camera.position.clone();
    const startControlsTarget = controls.target.clone();
    const startTime = performance.now();

    AppState.cameraAnimation = {
        update: (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1.0);
            const t = easeInOutCubic(progress);

            camera.position.lerpVectors(startCamPos, endCamPos, t);
            controls.target.lerpVectors(startControlsTarget, endTarget, t);
            controls.update();

            if (progress >= 1.0) {
                AppState.cameraAnimation = null;
            }
        }
    };
}

/**
 * Smoothly animates the camera to focus on a target 3D position
 */
export function flyToPosition(targetPosition: THREE.Vector3, normalOffset: THREE.Vector3 | null = null, duration = 800): void {
    const radius = AppState.modelBoundingSphere ? AppState.modelBoundingSphere.radius : 1.0;
    const viewDistance = radius * 0.65;

    const offsetDir = normalOffset
        ? normalOffset.clone().normalize()
        : camera.position.clone().sub(controls.target).normalize();

    const endCamPos = targetPosition.clone().add(offsetDir.multiplyScalar(viewDistance));
    animateCamera(endCamPos, targetPosition, duration);
}

/**
 * Smoothly returns camera to default anatomical perspective
 */
export function resetCameraView(): void {
    animateCamera(AppState.initialCameraPosition, AppState.initialCameraTarget, 700);
}
