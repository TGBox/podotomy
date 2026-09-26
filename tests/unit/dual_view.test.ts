import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { AppState } from '../../src/state.js';
import {
    createBadgeCanvas,
    createDotCanvas,
    syncSceneMarkers
} from '../../src/markers.js';
import {
    setActiveView,
    setMode,
    updateSidebarList,
    updateMarkerCounts,
    dom,
    initUI
} from '../../src/ui.js';
import { importMarkersJSON } from '../../src/storage.js';
import { markersGroup } from '../../src/scene.js';
import type { AnnotationMarker } from '../../src/types.js';

describe('Dual View (Knochen vs Haut) Architecture', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="canvas-container"></div>
            <button id="view-bone-btn" class="view-toggle-btn active" role="radio" aria-checked="true"></button>
            <button id="view-skin-btn" class="view-toggle-btn" role="radio" aria-checked="false"></button>
            <button id="mode-nav-btn" class="mode-btn active"></button>
            <button id="mode-add-btn" class="mode-btn"></button>
            <div id="mode-banner" class="mode-banner hidden">
                <span class="pulse-dot"></span>
                <span>Klicke auf das Modell</span>
            </div>
            <div id="sidebar" class="sidebar"></div>
            <button id="toggle-sidebar-btn"></button>
            <button id="close-sidebar-btn"></button>
            <div id="markers-list"></div>
            <span id="marker-count-badge">0</span>
            <span id="sidebar-count-pill">0 Punkte</span>
            <input id="search-input" type="text" />
            <button id="export-json-btn"></button>
            <button id="import-json-btn"></button>
            <input id="import-file-input" type="file" />
            <button id="clear-all-btn"></button>
            <div id="toast-container"></div>
        `;

        AppState.activeView = 'bone';
        AppState.mode = 'navigate';
        AppState.markers = [];
        AppState.selectedMarkerId = null;
        AppState.searchQuery = '';
        AppState.footModel = new THREE.Group();
        markersGroup.clear();
    });

    it('generates amber/coral canvas textures for skin badges and dots', () => {
        const badgeCanvas = createBadgeCanvas(1, true, false, 'skin');
        expect(badgeCanvas.width).toBe(256);
        expect(badgeCanvas.height).toBe(256);

        const dotCanvas = createDotCanvas(true, false, 'skin');
        expect(dotCanvas.width).toBe(128);
        expect(dotCanvas.height).toBe(128);
    });

    it('switches activeView and toggles DOM button classes and ARIA attributes', () => {
        const switchViewMock = vi.fn();
        initUI({ switchView: switchViewMock });

        setActiveView('skin');
        expect(AppState.activeView).toBe('skin');
        expect(dom.viewSkinBtn.classList.contains('active')).toBe(true);
        expect(dom.viewBoneBtn.classList.contains('active')).toBe(false);
        expect(dom.viewSkinBtn.getAttribute('aria-checked')).toBe('true');
        expect(dom.viewBoneBtn.getAttribute('aria-checked')).toBe('false');
        expect(switchViewMock).toHaveBeenCalledWith('skin');

        setActiveView('bone');
        expect(AppState.activeView).toBe('bone');
        expect(dom.viewBoneBtn.classList.contains('active')).toBe(true);
        expect(dom.viewSkinBtn.classList.contains('active')).toBe(false);
        expect(dom.viewBoneBtn.getAttribute('aria-checked')).toBe('true');
        expect(switchViewMock).toHaveBeenCalledWith('bone');
    });

    it('updates mode banner helper text according to active view in add mode', () => {
        setMode('add');
        setActiveView('bone');
        expect(dom.modeBanner.textContent).toContain('Knochenmodell');

        setActiveView('skin');
        expect(dom.modeBanner.textContent).toContain('Fußhaut');
    });

    it('separately numbers bone and skin markers and filters raycast interactive objects', () => {
        AppState.markers = [
            {
                id: 'b1',
                number: 1,
                title: 'Bone 1',
                description: 'First bone',
                position: { x: 0, y: 0, z: 0 },
                createdAt: '',
                view: 'bone'
            },
            {
                id: 'b2',
                number: 2,
                title: 'Bone 2',
                description: 'Second bone',
                position: { x: 1, y: 1, z: 1 },
                createdAt: '',
                view: 'bone'
            },
            {
                id: 's1',
                number: 1,
                title: 'Skin 1',
                description: 'First skin',
                position: { x: 2, y: 2, z: 2 },
                createdAt: '',
                view: 'skin'
            }
        ];

        // 1. In Bone view:
        AppState.activeView = 'bone';
        syncSceneMarkers();

        // Bone markers have numbers 1 and 2
        expect(AppState.markers[0].number).toBe(1);
        expect(AppState.markers[1].number).toBe(2);
        // Skin marker has its own separate sequence: number 1
        expect(AppState.markers[2].number).toBe(1);

        // Only bone marker components should be in interactive objects!
        const interactiveIds = AppState.interactiveMarkerObjects
            .map(obj => obj.userData?.markerId)
            .filter(Boolean);

        expect(interactiveIds).toContain('b1');
        expect(interactiveIds).toContain('b2');
        expect(interactiveIds).not.toContain('s1');

        // 2. Switch to Skin view:
        AppState.activeView = 'skin';
        syncSceneMarkers();

        const skinInteractiveIds = AppState.interactiveMarkerObjects
            .map(obj => obj.userData?.markerId)
            .filter(Boolean);

        expect(skinInteractiveIds).toContain('s1');
        expect(skinInteractiveIds).not.toContain('b1');
        expect(skinInteractiveIds).not.toContain('b2');
    });

    it('filters sidebar cards to only show markers of the active view', () => {
        AppState.markers = [
            { id: 'b1', number: 1, title: 'Calcaneus (Knochen)', description: '', position: { x: 0, y: 0, z: 0 }, createdAt: '', view: 'bone' },
            { id: 's1', number: 1, title: 'Fersenpolster (Haut)', description: '', position: { x: 0, y: 0, z: 0 }, createdAt: '', view: 'skin' }
        ];

        // In Bone view:
        AppState.activeView = 'bone';
        updateSidebarList();
        updateMarkerCounts();

        let cards = dom.markersList.querySelectorAll('.marker-card');
        expect(cards.length).toBe(1);
        expect(dom.markersList.textContent).toContain('Calcaneus');
        expect(dom.markersList.textContent).not.toContain('Fersenpolster');
        expect(dom.markerCountBadge.textContent).toBe('1');

        // In Skin view:
        AppState.activeView = 'skin';
        updateSidebarList();
        updateMarkerCounts();

        cards = dom.markersList.querySelectorAll('.marker-card');
        expect(cards.length).toBe(1);
        expect(dom.markersList.textContent).toContain('Fersenpolster');
        expect(dom.markersList.textContent).not.toContain('Calcaneus');
        expect(dom.markerCountBadge.textContent).toBe('1');
    });

    it('exports and imports JSON with view attribute preserved', () => {
        AppState.markers = [
            { id: 'b1', number: 1, title: 'Bone Marker', description: 'Desc', position: { x: 1, y: 2, z: 3 }, createdAt: '', view: 'bone' },
            { id: 's1', number: 1, title: 'Skin Marker', description: 'Desc', position: { x: 4, y: 5, z: 6 }, createdAt: '', view: 'skin' }
        ];

        const jsonFileContent = JSON.stringify({
            model: 'bones_foot.glb & skin_foot.glb',
            annotations: AppState.markers
        });

        const file = new File([jsonFileContent], 'test_annotations.json', { type: 'application/json' });
        const onSuccess = vi.fn();
        const onError = vi.fn();

        importMarkersJSON(file, onSuccess, onError);

        // Allow async FileReader callback
        setTimeout(() => {
            expect(onSuccess).toHaveBeenCalled();
            const imported: AnnotationMarker[] = onSuccess.mock.calls[0][0];
            expect(imported.length).toBe(2);
            expect(imported[0].view).toBe('bone');
            expect(imported[1].view).toBe('skin');
        }, 50);
    });
});
