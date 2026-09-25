import { describe, it, expect, beforeEach } from 'vitest';
import {
    escapeHtml,
    setMode,
    showToast,
    updateMarkerCounts,
    updateSidebarList,
    updateSidebarCardHighlight,
    dom
} from '../../src/ui.js';
import { AppState } from '../../src/state.js';
import type { AnnotationMarker } from '../../src/types.js';

describe('UI Components and Event Bindings', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="canvas-container"></div>
            <button id="mode-nav-btn" class="mode-btn active"></button>
            <button id="mode-add-btn" class="mode-btn"></button>
            <div id="mode-banner" class="mode-banner hidden"></div>
            <div id="sidebar" class="sidebar"></div>
            <button id="toggle-sidebar-btn"></button>
            <button id="close-sidebar-btn"></button>
            <div id="options-drawer" class="options-drawer hidden"></div>
            <button id="toggle-options-btn"></button>
            <button id="close-options-btn"></button>
            <button id="reset-view-btn"></button>
            <div id="markers-list"></div>
            <span id="marker-count-badge">0</span>
            <span id="sidebar-count-pill">0 Punkte</span>
            <input id="search-input" type="text" />
            <button id="export-json-btn"></button>
            <button id="import-json-btn"></button>
            <input id="import-file-input" type="file" />
            <button id="clear-all-btn"></button>
            <div id="floating-tooltip" class="floating-tooltip"></div>
            <span id="tooltip-badge"></span>
            <span id="tooltip-title"></span>
            <p id="tooltip-desc"></p>
            <button id="tooltip-close"></button>
            <button id="tooltip-focus-btn"></button>
            <button id="tooltip-edit-btn"></button>
            <button id="tooltip-delete-btn"></button>
            <dialog id="modal-add"><form id="modal-add-form"><input id="input-title" /><textarea id="input-desc"></textarea><button id="cancel-add-btn"></button></form></dialog>
            <dialog id="modal-edit"><form id="modal-edit-form"><input id="edit-marker-id" /><input id="edit-title" /><textarea id="edit-desc"></textarea><button id="cancel-edit-btn"></button></form></dialog>
            <input id="texture-toggle" type="checkbox" checked />
            <input id="texture-scale-slider" type="range" value="1" />
            <span id="tex-scale-val">1.0x</span>
            <input id="wireframe-toggle" type="checkbox" />
            <input id="ambient-light-slider" type="range" value="1.2" />
            <span id="ambient-val">1.2</span>
            <input id="dir-light-slider" type="range" value="1.6" />
            <span id="dir-val">1.6</span>
            <div id="toast-container"></div>
        `;

        AppState.mode = 'navigate';
        AppState.markers = [];
        AppState.searchQuery = '';
        AppState.selectedMarkerId = null;
    });

    it('sanitizes input with escapeHtml', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
        expect(escapeHtml('Hello & World')).toBe('Hello &amp; World');
    });

    it('switches interaction modes and updates DOM classes', () => {
        setMode('add');
        expect(AppState.mode).toBe('add');
        expect(dom.modeAddBtn.classList.contains('active')).toBe(true);
        expect(dom.modeNavBtn.classList.contains('active')).toBe(false);
        expect(dom.modeBanner.classList.contains('hidden')).toBe(false);

        setMode('navigate');
        expect(AppState.mode).toBe('navigate');
        expect(dom.modeNavBtn.classList.contains('active')).toBe(true);
        expect(dom.modeAddBtn.classList.contains('active')).toBe(false);
        expect(dom.modeBanner.classList.contains('hidden')).toBe(true);
    });

    it('updates marker counts with singular and plural formatting', () => {
        AppState.markers = [];
        updateMarkerCounts();
        expect(dom.markerCountBadge.textContent).toBe('0');
        expect(dom.sidebarCountPill.textContent).toBe('0 Punkte');

        AppState.markers = [{ id: '1', number: 1, title: 'T1', description: '', position: { x: 0, y: 0, z: 0 }, createdAt: '' }];
        updateMarkerCounts();
        expect(dom.markerCountBadge.textContent).toBe('1');
        expect(dom.sidebarCountPill.textContent).toBe('1 Punkt');

        AppState.markers.push({ id: '2', number: 2, title: 'T2', description: '', position: { x: 0, y: 0, z: 0 }, createdAt: '' });
        updateMarkerCounts();
        expect(dom.markerCountBadge.textContent).toBe('2');
        expect(dom.sidebarCountPill.textContent).toBe('2 Punkte');
    });

    it('renders and filters sidebar marker cards', () => {
        const markers: AnnotationMarker[] = [
            { id: '1', number: 1, title: 'Calcaneus (Fersenbein)', description: 'Großer Rückfußknochen', position: { x: 0, y: 0, z: 0 }, createdAt: '' },
            { id: '2', number: 2, title: 'Talus (Sprungbein)', description: 'Oberes Sprunggelenk', position: { x: 0, y: 0, z: 0 }, createdAt: '' }
        ];
        AppState.markers = markers;

        // Render all
        updateSidebarList();
        expect(dom.markersList.querySelectorAll('.marker-card').length).toBe(2);

        // Filter for Calcaneus
        AppState.searchQuery = 'calcaneus';
        updateSidebarList();
        expect(dom.markersList.querySelectorAll('.marker-card').length).toBe(1);
        expect(dom.markersList.textContent).toContain('Calcaneus');

        // Filter for no match
        AppState.searchQuery = 'non_existent_query';
        updateSidebarList();
        expect(dom.markersList.querySelectorAll('.marker-card').length).toBe(0);
        expect(dom.markersList.textContent).toContain('Keine Markierungen');
    });

    it('updates sidebar card highlight class based on active marker ID', () => {
        AppState.markers = [
            { id: 'm1', number: 1, title: 'M1', description: '', position: { x: 0, y: 0, z: 0 }, createdAt: '' },
            { id: 'm2', number: 2, title: 'M2', description: '', position: { x: 0, y: 0, z: 0 }, createdAt: '' }
        ];
        updateSidebarList();

        updateSidebarCardHighlight('m1');
        const cards = dom.markersList.querySelectorAll('.marker-card');
        expect(cards[0].classList.contains('active')).toBe(true);
        expect(cards[1].classList.contains('active')).toBe(false);

        updateSidebarCardHighlight('m2');
        expect(cards[0].classList.contains('active')).toBe(false);
        expect(cards[1].classList.contains('active')).toBe(true);
    });

    it('creates and displays toast notifications', () => {
        showToast('Erfolgreich gespeichert', 'success');
        const container = document.getElementById('toast-container');
        expect(container?.children.length).toBe(1);
        expect(container?.textContent).toContain('Erfolgreich gespeichert');
        expect(container?.children[0].className).toContain('toast-success');
    });
});
