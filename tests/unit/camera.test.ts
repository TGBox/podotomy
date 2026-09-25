import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { easeInOutCubic, flyToPosition, resetCameraView } from '../../src/camera.js';
import { AppState } from '../../src/state.js';
import { camera, controls } from '../../src/scene.js';

describe('Camera Transitions and Math', () => {
    beforeEach(() => {
        AppState.cameraAnimation = null;
        camera.position.set(100, 100, 100);
        controls.target.set(0, 0, 0);
    });

    it('calculates easeInOutCubic progression values correctly', () => {
        expect(easeInOutCubic(0)).toBe(0);
        expect(easeInOutCubic(1)).toBe(1);
        expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
        expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
        expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
    });

    it('initiates flyToPosition animation targeting requested coordinates', () => {
        const target = new THREE.Vector3(10, 20, 30);
        const normal = new THREE.Vector3(0, 1, 0);

        flyToPosition(target, normal, 500);

        expect(AppState.cameraAnimation).not.toBeNull();
        expect(typeof AppState.cameraAnimation?.update).toBe('function');

        // Simulate frame step
        AppState.cameraAnimation?.update(performance.now() + 250);
        expect(controls.target.x).not.toBe(0);

        // Simulate animation completion
        AppState.cameraAnimation?.update(performance.now() + 600);
        expect(AppState.cameraAnimation).toBeNull();
    });

    it('initiates resetCameraView targeting initial camera orientation', () => {
        resetCameraView();
        expect(AppState.cameraAnimation).not.toBeNull();

        // Advance to completion
        AppState.cameraAnimation?.update(performance.now() + 800);
        expect(AppState.cameraAnimation).toBeNull();
    });
});
