import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, getMarkerById, getSelectedMarker } from '../../src/state.js';
import type { AnnotationMarker } from '../../src/types.js';

describe('AppState Management', () => {
    beforeEach(() => {
        AppState.mode = 'navigate';
        AppState.markers = [];
        AppState.selectedMarkerId = null;
        AppState.hoveredMarkerId = null;
        AppState.searchQuery = '';
        AppState.interactiveMarkerObjects = [];
    });

    it('initializes with expected default values', () => {
        expect(AppState.mode).toBe('navigate');
        expect(AppState.markers).toEqual([]);
        expect(AppState.selectedMarkerId).toBeNull();
        expect(AppState.hoveredMarkerId).toBeNull();
        expect(AppState.useTexture).toBe(true);
        expect(AppState.wireframeEnabled).toBe(false);
        expect(AppState.initialCameraPosition.x).toBe(140);
        expect(AppState.initialCameraPosition.y).toBe(100);
        expect(AppState.initialCameraPosition.z).toBe(200);
    });

    it('retrieves marker by id with getMarkerById', () => {
        const marker: AnnotationMarker = {
            id: 'm1',
            number: 1,
            title: 'Calcaneus Test',
            description: 'Heel bone test',
            position: { x: 10, y: 20, z: 30 },
            normal: { x: 0, y: 1, z: 0 },
            createdAt: new Date().toISOString()
        };
        AppState.markers.push(marker);

        expect(getMarkerById('m1')).toEqual(marker);
        expect(getMarkerById('non_existent')).toBeNull();
    });

    it('retrieves selected marker with getSelectedMarker', () => {
        expect(getSelectedMarker()).toBeNull();

        const marker: AnnotationMarker = {
            id: 'm2',
            number: 2,
            title: 'Talus Test',
            description: 'Ankle joint',
            position: { x: 5, y: 15, z: 25 },
            createdAt: new Date().toISOString()
        };
        AppState.markers.push(marker);
        AppState.selectedMarkerId = 'm2';

        expect(getSelectedMarker()).toEqual(marker);

        AppState.selectedMarkerId = 'unknown';
        expect(getSelectedMarker()).toBeNull();
    });
});
