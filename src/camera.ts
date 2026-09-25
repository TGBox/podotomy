import * as THREE from 'three';
import { camera, controls } from './scene.js';
import { AppState } from './state.js';

export function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Smoothly animates the camera to focus on a target 3D position
 * @param targetPosition 
 * @param normalOffset Optional surface normal offset
 * @param duration Duration in milliseconds
 */
export function flyToPosition(targetPosition: THREE.Vector3, normalOffset: THREE.Vector3 | null = null, duration = 800): void {
    const startCamPos = camera.position.clone();
    const startControlsTarget = controls.target.clone();

    const endTarget = targetPosition.clone();
    const radius = AppState.modelBoundingSphere ? AppState.modelBoundingSphere.radius : 1.0;
    const viewDistance = radius * 0.65;

    let endCamPos: THREE.Vector3;
    if (normalOffset) {
        endCamPos = targetPosition.clone().add(normalOffset.clone().normalize().multiplyScalar(viewDistance));
    } else {
        const offsetDir = camera.position.clone().sub(controls.target).normalize();
        endCamPos = targetPosition.clone().add(offsetDir.multiplyScalar(viewDistance));
    }

    const startTime = performance.now();

    AppState.cameraAnimation = {
        update: (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1.0);
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
 * Smoothly returns camera to default anatomical perspective
 */
export function resetCameraView(): void {
    const startCamPos = camera.position.clone();
    const startControlsTarget = controls.target.clone();
    const endCamPos = AppState.initialCameraPosition.clone();
    const endTarget = AppState.initialCameraTarget.clone();
    const startTime = performance.now();

    AppState.cameraAnimation = {
        update: (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / 700, 1.0);
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
