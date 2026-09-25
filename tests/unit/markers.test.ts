import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
    createBadgeCanvas,
    createDotCanvas,
    createMarkerVisual,
    updateMarkerOcclusion,
    syncSceneMarkers
} from '../../src/markers.js';
import { AppState } from '../../src/state.js';
import { camera, markersGroup } from '../../src/scene.js';
import type { AnnotationMarker } from '../../src/types.js';

describe('Marker Graphics and Occlusion Logic', () => {
    beforeEach(() => {
        AppState.markers = [];
        AppState.selectedMarkerId = null;
        AppState.footModel = new THREE.Group();
        markersGroup.clear();
    });

    it('generates 2D canvas textures for badge and dot', () => {
        const badge = createBadgeCanvas(1, false, false);
        expect(badge.width).toBe(256);
        expect(badge.height).toBe(256);

        const dot = createDotCanvas(false, false);
        expect(dot.width).toBe(128);
        expect(dot.height).toBe(128);
    });

    it('builds 3D visual hierarchy with sprite, stem, anchor dot and hit sphere', () => {
        const marker: AnnotationMarker = {
            id: 'm_vis_1',
            number: 1,
            title: 'Test Marker',
            description: 'Testing visual hierarchy',
            position: { x: 5, y: 10, z: 15 },
            normal: { x: 0, y: 1, z: 0 },
            createdAt: new Date().toISOString()
        };

        const { group, sprite } = createMarkerVisual(marker);
        expect(group).toBeDefined();
        expect(sprite).toBeDefined();
        expect(group.children.length).toBe(4); // dotMesh, stemLine, sprite, hitMesh

        // Verify position and normal alignment
        expect(group.position.x).toBe(5);
        expect(group.position.y).toBe(10);
        expect(group.position.z).toBe(15);
    });

    it('determines occlusion based on surface normal orientation', () => {
        const marker: AnnotationMarker = {
            id: 'm_occ_1',
            number: 1,
            title: 'Occlusion Target',
            description: 'Testing back-face occlusion',
            position: { x: 0, y: 0, z: 0 },
            normal: { x: 0, y: 0, z: 1 }, // faces towards +Z
            createdAt: new Date().toISOString()
        };

        const { group } = createMarkerVisual(marker);
        marker.threeGroup = group;
        AppState.markers = [marker];

        // 1. Camera in front (+Z) looking towards marker (facing camera)
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld(true);
        group.updateMatrixWorld(true);

        updateMarkerOcclusion();
        expect(marker.isOccluded).toBe(false);

        // 2. Camera behind (-Z) looking towards marker (facing away from camera)
        camera.position.set(0, 0, -100);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld(true);

        updateMarkerOcclusion();
        expect(marker.isOccluded).toBe(true);
    });

    it('synchronizes scene markers and populates interactive raycast list', () => {
        AppState.markers = [
            {
                id: 'm_sync_1',
                number: 1,
                title: 'Sync Point 1',
                description: 'Test',
                position: { x: 1, y: 2, z: 3 },
                createdAt: new Date().toISOString()
            },
            {
                id: 'm_sync_2',
                number: 2,
                title: 'Sync Point 2',
                description: 'Test',
                position: { x: 4, y: 5, z: 6 },
                createdAt: new Date().toISOString()
            }
        ];

        syncSceneMarkers();

        expect(markersGroup.children.length).toBe(2);
        expect(AppState.interactiveMarkerObjects.length).toBeGreaterThanOrEqual(4);
    });
});
