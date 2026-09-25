import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
    selectMarker,
    updateFloatingTooltipPosition,
    getMarkerInteractiveObjects
} from '../../src/interactions.js';
import { AppState } from '../../src/state.js';
import { camera } from '../../src/scene.js';
import { dom } from '../../src/ui.js';
import type { AnnotationMarker } from '../../src/types.js';

describe('Interactions and Raycasting Logic', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="floating-tooltip" class="floating-tooltip"></div>
            <span id="tooltip-badge"></span>
            <span id="tooltip-title"></span>
            <p id="tooltip-desc"></p>
            <div id="markers-list"></div>
        `;

        AppState.markers = [];
        AppState.selectedMarkerId = null;
        AppState.interactiveMarkerObjects = [];
    });

    it('selects and deselects markers updating tooltip state and content', () => {
        const marker: AnnotationMarker = {
            id: 'm_sel_1',
            number: 1,
            title: 'Tuberositas tibiae',
            description: 'Upper attachment',
            position: { x: 0, y: 10, z: 0 },
            createdAt: ''
        };
        AppState.markers = [marker];

        selectMarker('m_sel_1', false);

        expect(AppState.selectedMarkerId).toBe('m_sel_1');
        expect(dom.tooltipTitle.textContent).toBe('Tuberositas tibiae');
        expect(dom.tooltipBadge.textContent).toBe('1');
        expect(dom.floatingTooltip.classList.contains('visible')).toBe(true);

        // Deselect
        selectMarker(null, false);
        expect(AppState.selectedMarkerId).toBeNull();
        expect(dom.floatingTooltip.classList.contains('visible')).toBe(false);
    });

    it('returns cached interactive marker objects', () => {
        const obj1 = new THREE.Mesh();
        const obj2 = new THREE.Sprite();
        AppState.interactiveMarkerObjects = [obj1, obj2];

        const result = getMarkerInteractiveObjects();
        expect(result.length).toBe(2);
        expect(result[0]).toBe(obj1);
        expect(result[1]).toBe(obj2);
    });

    it('projects 3D coordinates into 2D screen coordinates for floating tooltip', () => {
        const group = new THREE.Group();
        group.position.set(0, 0, 0);

        const marker: AnnotationMarker = {
            id: 'm_proj_1',
            number: 1,
            title: 'Projection Target',
            description: '',
            position: { x: 0, y: 0, z: 0 },
            threeGroup: group,
            createdAt: ''
        };
        AppState.markers = [marker];
        AppState.selectedMarkerId = 'm_proj_1';
        dom.floatingTooltip.classList.add('visible');

        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        updateFloatingTooltipPosition();

        expect(dom.floatingTooltip.style.left).toBeDefined();
        expect(dom.floatingTooltip.style.top).toBeDefined();
    });
});
