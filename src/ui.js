import * as THREE from 'three';
import { AppState } from './state.js';
import { scene, ambientLight, dirLight } from './scene.js';
import { boneMaterial, defaultMaterial, updateTextureScale } from './materials.js';
import { exportMarkersJSON, importMarkersJSON } from './storage.js';

// --- Cached DOM Element References ---
export const dom = {
    canvasContainer: document.getElementById('canvas-container'),
    modeNavBtn: document.getElementById('mode-nav-btn'),
    modeAddBtn: document.getElementById('mode-add-btn'),
    modeBanner: document.getElementById('mode-banner'),
    sidebar: document.getElementById('sidebar'),
    toggleSidebarBtn: document.getElementById('toggle-sidebar-btn'),
    closeSidebarBtn: document.getElementById('close-sidebar-btn'),
    optionsDrawer: document.getElementById('options-drawer'),
    toggleOptionsBtn: document.getElementById('toggle-options-btn'),
    closeOptionsBtn: document.getElementById('close-options-btn'),
    resetViewBtn: document.getElementById('reset-view-btn'),
    markersList: document.getElementById('markers-list'),
    markerCountBadge: document.getElementById('marker-count-badge'),
    sidebarCountPill: document.getElementById('sidebar-count-pill'),
    searchInput: document.getElementById('search-input'),
    exportBtn: document.getElementById('export-json-btn'),
    importBtn: document.getElementById('import-json-btn'),
    importFileInput: document.getElementById('import-file-input'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    floatingTooltip: document.getElementById('floating-tooltip'),
    tooltipBadge: document.getElementById('tooltip-badge'),
    tooltipTitle: document.getElementById('tooltip-title'),
    tooltipDesc: document.getElementById('tooltip-desc'),
    tooltipCloseBtn: document.getElementById('tooltip-close'),
    tooltipFocusBtn: document.getElementById('tooltip-focus-btn'),
    tooltipEditBtn: document.getElementById('tooltip-edit-btn'),
    tooltipDeleteBtn: document.getElementById('tooltip-delete-btn'),
    modalAdd: document.getElementById('modal-add'),
    modalAddForm: document.getElementById('modal-add-form'),
    inputTitle: document.getElementById('input-title'),
    inputDesc: document.getElementById('input-desc'),
    cancelAddBtn: document.getElementById('cancel-add-btn'),
    modalEdit: document.getElementById('modal-edit'),
    modalEditForm: document.getElementById('modal-edit-form'),
    editIdInput: document.getElementById('edit-marker-id'),
    editTitleInput: document.getElementById('edit-title'),
    editDescInput: document.getElementById('edit-desc'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    textureToggle: document.getElementById('texture-toggle'),
    textureScaleSlider: document.getElementById('texture-scale-slider'),
    texScaleValSpan: document.getElementById('tex-scale-val'),
    wireframeToggle: document.getElementById('wireframe-toggle'),
    ambientLightSlider: document.getElementById('ambient-light-slider'),
    ambientValSpan: document.getElementById('ambient-val'),
    dirLightSlider: document.getElementById('dir-light-slider'),
    dirValSpan: document.getElementById('dir-val'),
    themeChips: document.querySelectorAll('.theme-chip'),
    loadingOverlay: document.getElementById('loading-overlay'),
    progressBar: document.getElementById('progress-bar'),
    progressPercent: document.getElementById('progress-percent'),
    progressBytes: document.getElementById('progress-bytes')
};

// Callback handlers configured by main application
let actions = {
    selectMarker: () => {},
    syncSceneMarkers: () => {},
    resetCameraView: () => {}
};

/**
 * Escapes HTML characters for safe template rendering
 * @param {string} text 
 * @returns {string}
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Displays a non-intrusive floating toast notification
 * @param {string} message 
 * @param {'info'|'success'|'warning'|'error'} type 
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * Switches interaction mode between 'navigate' and 'add'
 * @param {'navigate'|'add'} newMode 
 */
export function setMode(newMode) {
    AppState.mode = newMode;

    if (newMode === 'navigate') {
        dom.modeNavBtn.classList.add('active');
        dom.modeAddBtn.classList.remove('active');
        dom.modeBanner.classList.add('hidden');
        dom.canvasContainer.classList.remove('crosshair-cursor');
    } else {
        dom.modeAddBtn.classList.add('active');
        dom.modeNavBtn.classList.remove('active');
        dom.modeBanner.classList.remove('hidden');
        dom.canvasContainer.classList.add('crosshair-cursor');
        actions.selectMarker(null); // deselect existing when in add mode
    }
}

/**
 * Opens modal dialog to add a new annotation
 */
export function openAddModal() {
    dom.inputTitle.value = '';
    dom.inputDesc.value = '';
    dom.modalAdd.showModal();
    dom.inputTitle.focus();
}

/**
 * Opens modal dialog to edit an existing annotation
 * @param {string} markerId 
 */
export function openEditModal(markerId) {
    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker) return;

    dom.editIdInput.value = marker.id;
    dom.editTitleInput.value = marker.title;
    dom.editDescInput.value = marker.description || '';
    dom.modalEdit.showModal();
    dom.editTitleInput.focus();
}

/**
 * Prompts user confirmation and deletes an annotation
 * @param {string} markerId 
 */
export function deleteMarker(markerId) {
    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker) return;

    if (confirm(`Möchtest du den Punkt #${marker.number} "${marker.title}" wirklich löschen?`)) {
        AppState.markers = AppState.markers.filter(m => m.id !== markerId);
        if (AppState.selectedMarkerId === markerId) {
            actions.selectMarker(null);
        }
        actions.syncSceneMarkers();
        showToast('Markierung gelöscht.', 'info');
    }
}

/**
 * Renders filtered sidebar annotations list
 */
export function updateSidebarList() {
    const query = AppState.searchQuery.toLowerCase().trim();
    const filtered = AppState.markers.filter(m => {
        return m.title.toLowerCase().includes(query) || (m.description && m.description.toLowerCase().includes(query));
    });

    dom.markersList.innerHTML = '';

    if (filtered.length === 0) {
        if (AppState.markers.length === 0) {
            dom.markersList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>Noch keine Punkte gesetzt.<br>Wähle oben <strong>"Punkt hinzufügen"</strong> und klicke auf das 3D-Fußmodell.</p>
                </div>
            `;
        } else {
            dom.markersList.innerHTML = `
                <div class="empty-state">
                    <p>Keine Markierungen für <em>"${query}"</em> gefunden.</p>
                </div>
            `;
        }
        return;
    }

    filtered.forEach(marker => {
        const card = document.createElement('div');
        card.className = `marker-card ${marker.id === AppState.selectedMarkerId ? 'active' : ''}`;
        card.dataset.markerId = marker.id;

        card.innerHTML = `
            <div class="marker-badge-icon">${marker.number}</div>
            <div class="marker-details">
                <div class="marker-title-row">
                    <span class="marker-card-title">${escapeHtml(marker.title)}</span>
                </div>
                <div class="marker-card-desc">${escapeHtml(marker.description || 'Keine Beschreibung')}</div>
                <div class="marker-card-actions">
                    <button class="card-action-btn focus-btn" title="Kamera fokussieren">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"></circle><line x1="12" y1="2" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="22"></line><line x1="2" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="22" y2="12"></line></svg>
                        Fokus
                    </button>
                    <button class="card-action-btn edit-btn" title="Bearbeiten">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                    <button class="card-action-btn delete-btn" title="Löschen">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;

        // Card Click -> Select & Fly
        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-action-btn')) return;
            actions.selectMarker(marker.id, true);
        });

        // Focus Button
        card.querySelector('.focus-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            actions.selectMarker(marker.id, true);
        });

        // Edit Button
        card.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(marker.id);
        });

        // Delete Button
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteMarker(marker.id);
        });

        dom.markersList.appendChild(card);
    });
}

/**
 * Updates CSS active highlight class on the matching sidebar card
 * @param {string|null} selectedId 
 */
export function updateSidebarCardHighlight(selectedId) {
    document.querySelectorAll('.marker-card').forEach(card => {
        if (card.dataset.markerId === selectedId) {
            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            card.classList.remove('active');
        }
    });
}

/**
 * Updates marker count badges in header and sidebar
 */
export function updateMarkerCounts() {
    const count = AppState.markers.length;
    dom.markerCountBadge.textContent = count;
    dom.sidebarCountPill.textContent = `${count} ${count === 1 ? 'Punkt' : 'Punkte'}`;
}

/**
 * Initializes and binds all UI events, forms, controls, and dialogs
 * @param {object} actionHandlers 
 */
export function initUI(actionHandlers) {
    actions = { ...actions, ...actionHandlers };

    // --- Mode Buttons ---
    dom.modeNavBtn.addEventListener('click', () => setMode('navigate'));
    dom.modeAddBtn.addEventListener('click', () => setMode('add'));

    // --- Search Input ---
    dom.searchInput.addEventListener('input', (e) => {
        AppState.searchQuery = e.target.value;
        updateSidebarList();
    });

    // --- Modal Add Marker Form ---
    dom.modalAddForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = dom.inputTitle.value.trim();
        const description = dom.inputDesc.value.trim();

        if (!title || !AppState.pendingHit) return;

        // Slight offset along face normal to avoid surface clipping
        const pos = AppState.pendingHit.point.clone().addScaledVector(AppState.pendingHit.normal, 0.001);

        const newMarker = {
            id: 'marker_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            number: AppState.markers.length + 1,
            title: title,
            description: description,
            position: { x: pos.x, y: pos.y, z: pos.z },
            normal: { x: AppState.pendingHit.normal.x, y: AppState.pendingHit.normal.y, z: AppState.pendingHit.normal.z },
            createdAt: new Date().toISOString()
        };

        AppState.markers.push(newMarker);
        actions.syncSceneMarkers();
        actions.selectMarker(newMarker.id, true);

        dom.modalAdd.close();
        AppState.pendingHit = null;

        setMode('navigate');
        showToast(`Punkt "${title}" erfolgreich hinzugefügt!`, 'success');
    });

    dom.cancelAddBtn.addEventListener('click', () => {
        dom.modalAdd.close();
        AppState.pendingHit = null;
    });

    dom.modalAdd.addEventListener('cancel', () => {
        AppState.pendingHit = null;
    });

    // --- Modal Edit Marker Form ---
    dom.modalEditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = dom.editIdInput.value;
        const title = dom.editTitleInput.value.trim();
        const description = dom.editDescInput.value.trim();

        const marker = AppState.markers.find(m => m.id === id);
        if (marker) {
            marker.title = title;
            marker.description = description;
            actions.syncSceneMarkers();
            actions.selectMarker(id, false);
            dom.modalEdit.close();
            showToast('Markierung aktualisiert.', 'success');
        }
    });

    dom.cancelEditBtn.addEventListener('click', () => {
        dom.modalEdit.close();
    });

    // --- Tooltip Action Buttons ---
    dom.tooltipCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        actions.selectMarker(null);
    });

    dom.tooltipFocusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (AppState.selectedMarkerId) actions.selectMarker(AppState.selectedMarkerId, true);
    });

    dom.tooltipEditBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (AppState.selectedMarkerId) openEditModal(AppState.selectedMarkerId);
    });

    dom.tooltipDeleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (AppState.selectedMarkerId) deleteMarker(AppState.selectedMarkerId);
    });

    // Keyboard shortcut (Escape key deselects active marker and closes tooltip)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && AppState.selectedMarkerId) {
            actions.selectMarker(null);
        }
    });

    // --- Display & Render Options Drawer ---
    dom.textureToggle.addEventListener('change', (e) => {
        AppState.useTexture = e.target.checked;
        if (AppState.footModel) {
            AppState.footModel.traverse((child) => {
                if (child.isMesh) {
                    child.material = AppState.useTexture ? boneMaterial : defaultMaterial;
                    child.material.wireframe = AppState.wireframeEnabled;
                }
            });
        }
    });

    dom.textureScaleSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        dom.texScaleValSpan.textContent = `${val.toFixed(1)}x`;
        updateTextureScale(val);
    });

    dom.wireframeToggle.addEventListener('change', (e) => {
        AppState.wireframeEnabled = e.target.checked;
        boneMaterial.wireframe = AppState.wireframeEnabled;
        defaultMaterial.wireframe = AppState.wireframeEnabled;
        if (AppState.footModel) {
            AppState.footModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.wireframe = AppState.wireframeEnabled;
                }
            });
        }
    });

    dom.ambientLightSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        ambientLight.intensity = val;
        dom.ambientValSpan.textContent = val.toFixed(1);
    });

    dom.dirLightSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        dirLight.intensity = val;
        dom.dirValSpan.textContent = val.toFixed(1);
    });

    dom.themeChips.forEach(chip => {
        chip.addEventListener('click', () => {
            dom.themeChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const color = chip.dataset.color;
            scene.background = new THREE.Color(color);
            document.body.style.backgroundColor = color;
        });
    });

    dom.resetViewBtn.addEventListener('click', () => actions.resetCameraView());

    // --- Panel Toggles (Sidebar & Options) ---
    dom.toggleSidebarBtn.addEventListener('click', () => {
        dom.sidebar.classList.toggle('collapsed');
        dom.toggleSidebarBtn.classList.toggle('active', !dom.sidebar.classList.contains('collapsed'));
    });

    dom.closeSidebarBtn.addEventListener('click', () => {
        dom.sidebar.classList.add('collapsed');
        dom.toggleSidebarBtn.classList.remove('active');
    });

    dom.toggleOptionsBtn.addEventListener('click', () => {
        dom.optionsDrawer.classList.toggle('hidden');
        dom.toggleOptionsBtn.classList.toggle('active', !dom.optionsDrawer.classList.contains('hidden'));
    });

    dom.closeOptionsBtn.addEventListener('click', () => {
        dom.optionsDrawer.classList.add('hidden');
        dom.toggleOptionsBtn.classList.remove('active');
    });

    // --- Export / Import Buttons ---
    dom.exportBtn.addEventListener('click', () => {
        const ok = exportMarkersJSON();
        if (ok) {
            showToast('Markierungen als JSON exportiert!', 'success');
        } else {
            showToast('Keine Markierungen zum Exportieren vorhanden.', 'warning');
        }
    });

    dom.importBtn.addEventListener('click', () => {
        dom.importFileInput.value = '';
        dom.importFileInput.click();
    });

    dom.importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        importMarkersJSON(
            file,
            (importedMarkers) => {
                AppState.markers = importedMarkers;
                actions.syncSceneMarkers();
                actions.selectMarker(null);
                showToast(`${importedMarkers.length} Markierungen erfolgreich importiert!`, 'success');
            },
            (err) => {
                showToast('Fehler beim Importieren: ' + err.message, 'error');
            }
        );
    });

    dom.clearAllBtn.addEventListener('click', () => {
        if (AppState.markers.length === 0) return;
        if (confirm('Möchtest du wirklich ALLE gesetzten Punkte unwiderruflich löschen?')) {
            AppState.markers = [];
            actions.selectMarker(null);
            actions.syncSceneMarkers();
            showToast('Alle Markierungen wurden gelöscht.', 'info');
        }
    });
}
