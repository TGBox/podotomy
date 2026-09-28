import * as THREE from 'three';
import { AppState } from './state.js';
import { scene, ambientLight, dirLight } from './scene.js';
import { boneMaterial, defaultMaterial, updateTextureScale, skinMaterial, defaultSkinMaterial, updateSkinTextureScale } from './materials.js';
import { exportMarkersJSON, importMarkersJSON } from './storage.js';
import type { ActionHandlers, InteractionMode, AnnotationMarker } from './types.js';

// --- DOM Element References ---
const elementOverrides: Record<string, string> = {
    exportBtn: 'export-json-btn',
    importBtn: 'import-json-btn',
    tooltipCloseBtn: 'tooltip-close',
    editIdInput: 'edit-marker-id'
};

const toKebab = (str: string) => str.replace(/([A-Z])/g, '-$1').toLowerCase();

type AnyDomElement = HTMLElement & HTMLInputElement & HTMLDialogElement & HTMLButtonElement;

export const dom = new Proxy({} as Record<string, AnyDomElement> & { themeChips: NodeListOf<Element> }, {
    get: (_, key: string) => {
        if (typeof document === 'undefined') return null;
        if (key === 'themeChips') return document.querySelectorAll('.theme-chip');
        const id = elementOverrides[key] || toKebab(key);
        return document.getElementById(id);
    }
});

// Callback handlers configured by main application
let actions: ActionHandlers = {
    selectMarker: () => {},
    syncSceneMarkers: () => {},
    resetCameraView: () => {},
    switchView: () => {}
};

/**
 * Escapes HTML characters for safe template rendering
 */
export function escapeHtml(text: string): string {
    return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] || c);
}

/**
 * Displays a non-intrusive floating toast notification
 */
export function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
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
 */
export function setMode(newMode: InteractionMode): void {
    AppState.mode = newMode;

    if (newMode === 'navigate') {
        dom.modeNavBtn?.classList.add('active');
        dom.modeAddBtn?.classList.remove('active');
        dom.modeBanner?.classList.add('hidden');
        dom.canvasContainer?.classList.remove('crosshair-cursor');
    } else {
        dom.modeAddBtn?.classList.add('active');
        dom.modeNavBtn?.classList.remove('active');
        dom.modeBanner?.classList.remove('hidden');
        if (dom.modeBanner) {
            const span = dom.modeBanner.querySelector('span:last-child');
            if (span) {
                span.textContent = AppState.activeView === 'skin'
                    ? 'Klicke auf die Fußhaut, um eine Beschriftung zu platzieren'
                    : 'Klicke auf das Knochenmodell, um eine Beschriftung zu platzieren';
            }
        }
        dom.canvasContainer?.classList.add('crosshair-cursor');
        actions.selectMarker?.(null); // deselect existing when in add mode
    }
}

/**
 * Switches active anatomical model view between 'bone' and 'skin'
 */
export function setActiveView(newView: 'bone' | 'skin'): void {
    if (AppState.activeView === newView) return;
    AppState.activeView = newView;

    if (dom.viewBoneBtn) {
        dom.viewBoneBtn.classList.toggle('active', newView === 'bone');
        dom.viewBoneBtn.setAttribute('aria-checked', String(newView === 'bone'));
    }
    if (dom.viewSkinBtn) {
        dom.viewSkinBtn.classList.toggle('active', newView === 'skin');
        dom.viewSkinBtn.setAttribute('aria-checked', String(newView === 'skin'));
    }

    if (dom.modeBanner) {
        const span = dom.modeBanner.querySelector('span:last-child');
        if (span) {
            span.textContent = newView === 'skin'
                ? 'Klicke auf die Fußhaut, um eine Beschriftung zu platzieren'
                : 'Klicke auf das Knochenmodell, um eine Beschriftung zu platzieren';
        }
    }

    actions.switchView?.(newView);
    updateSidebarList();
    updateMarkerCounts();
    showToast(newView === 'skin' ? 'Hautansicht aktiviert' : 'Knochenansicht aktiviert', 'info');
}

/**
 * Opens modal dialog to add a new annotation
 */
export function openAddModal(): void {
    if (!dom.modalAdd) return;
    dom.inputTitle.value = '';
    dom.inputDesc.value = '';
    dom.modalAdd.showModal();
    dom.inputTitle.focus();
}

/**
 * Opens modal dialog to edit an existing annotation
 */
export function openEditModal(markerId: string): void {
    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker || !dom.modalEdit) return;

    dom.editIdInput.value = marker.id;
    dom.editTitleInput.value = marker.title;
    dom.editDescInput.value = marker.description || '';
    dom.modalEdit.showModal();
    dom.editTitleInput.focus();
}

/**
 * Prompts user confirmation and deletes an annotation
 */
export function deleteMarker(markerId: string): void {
    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker) return;

    if (confirm(`Möchtest du den Punkt #${marker.number} "${marker.title}" wirklich löschen?`)) {
        AppState.markers = AppState.markers.filter(m => m.id !== markerId);
        if (AppState.selectedMarkerId === markerId) {
            actions.selectMarker?.(null);
        }
        actions.syncSceneMarkers?.();
        showToast('Markierung gelöscht.', 'info');
    }
}

/**
 * Renders filtered sidebar annotations list for the ACTIVE view only
 */
export function updateSidebarList(): void {
    if (!dom.markersList) return;

    const currentView = AppState.activeView;
    const currentViewMarkers = AppState.markers.filter(m => (m.view || 'bone') === currentView);
    const query = AppState.searchQuery.toLowerCase().trim();
    const filtered = currentViewMarkers.filter(m => {
        return m.title.toLowerCase().includes(query) || (m.description && m.description.toLowerCase().includes(query));
    });

    dom.markersList.innerHTML = '';

    if (filtered.length === 0) {
        if (currentViewMarkers.length === 0) {
            const viewName = currentView === 'skin' ? 'Hautansicht' : 'Knochenansicht';
            const modelTarget = currentView === 'skin' ? 'die Fußhaut' : 'das Knochenmodell';
            dom.markersList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>Noch keine Punkte in der <strong>${viewName}</strong> gesetzt.<br>Wähle oben <strong>"Punkt hinzufügen"</strong> und klicke auf ${modelTarget}.</p>
                </div>
            `;
        } else {
            dom.markersList.innerHTML = `
                <div class="empty-state">
                    <p>Keine Markierungen für <em>"${escapeHtml(query)}"</em> gefunden.</p>
                </div>
            `;
        }
        return;
    }

    filtered.forEach(marker => {
        const isSkin = (marker.view || 'bone') === 'skin';
        const card = document.createElement('div');
        card.className = `marker-card ${isSkin ? 'skin-marker' : ''} ${marker.id === AppState.selectedMarkerId ? 'active' : ''}`;
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
            const target = e.target as HTMLElement;
            if (target.closest('.card-action-btn')) return;
            actions.selectMarker?.(marker.id, true);
        });

        // Focus Button
        card.querySelector('.focus-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            actions.selectMarker?.(marker.id, true);
        });

        // Edit Button
        card.querySelector('.edit-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(marker.id);
        });

        // Delete Button
        card.querySelector('.delete-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteMarker(marker.id);
        });

        dom.markersList.appendChild(card);
    });
}

/**
 * Updates CSS active highlight class on the matching sidebar card
 */
export function updateSidebarCardHighlight(selectedId: string | null): void {
    document.querySelectorAll('.marker-card').forEach(card => {
        const el = card as HTMLElement;
        if (el.dataset.markerId === selectedId) {
            el.classList.add('active');
            if (typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } else {
            el.classList.remove('active');
        }
    });
}

/**
 * Updates marker count badges in header and sidebar for current view
 */
export function updateMarkerCounts(): void {
    const currentViewMarkers = AppState.markers.filter(m => (m.view || 'bone') === AppState.activeView);
    const count = currentViewMarkers.length;
    if (dom.markerCountBadge) dom.markerCountBadge.textContent = String(count);
    if (dom.sidebarCountPill) dom.sidebarCountPill.textContent = `${count} ${count === 1 ? 'Punkt' : 'Punkte'}`;
}

/**
 * Initializes and binds all UI events, forms, controls, and dialogs
 */
export function initUI(actionHandlers: ActionHandlers): void {
    actions = { ...actions, ...actionHandlers };

    // --- View Toggle Buttons ---
    dom.viewBoneBtn?.addEventListener('click', () => setActiveView('bone'));
    dom.viewSkinBtn?.addEventListener('click', () => setActiveView('skin'));

    // --- Mode Buttons ---
    dom.modeNavBtn?.addEventListener('click', () => setMode('navigate'));
    dom.modeAddBtn?.addEventListener('click', () => setMode('add'));

    // --- Search Input ---
    dom.searchInput?.addEventListener('input', (e) => {
        AppState.searchQuery = (e.target as HTMLInputElement).value;
        updateSidebarList();
    });

    // --- Modal Add Marker Form ---
    dom.modalAddForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = dom.inputTitle.value.trim();
        const description = dom.inputDesc.value.trim();

        if (!title || !AppState.pendingHit) return;

        // Slight offset along face normal to avoid surface clipping
        const pos = AppState.pendingHit.point.clone().addScaledVector(AppState.pendingHit.normal, 0.001);

        const currentViewMarkers = AppState.markers.filter(m => (m.view || 'bone') === AppState.activeView);
        const newMarker: AnnotationMarker = {
            id: 'marker_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            number: currentViewMarkers.length + 1,
            title: title,
            description: description,
            position: { x: pos.x, y: pos.y, z: pos.z },
            normal: { x: AppState.pendingHit.normal.x, y: AppState.pendingHit.normal.y, z: AppState.pendingHit.normal.z },
            createdAt: new Date().toISOString(),
            view: AppState.activeView
        };

        AppState.markers.push(newMarker);
        actions.syncSceneMarkers?.();
        actions.selectMarker?.(newMarker.id, true);

        dom.modalAdd.close();
        AppState.pendingHit = null;

        setMode('navigate');
        showToast(`Punkt "${title}" erfolgreich hinzugefügt!`, 'success');
    });

    dom.cancelAddBtn?.addEventListener('click', () => {
        dom.modalAdd?.close();
        AppState.pendingHit = null;
    });

    dom.modalAdd?.addEventListener('cancel', () => {
        AppState.pendingHit = null;
    });

    // --- Modal Edit Marker Form ---
    dom.modalEditForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = dom.editIdInput.value;
        const title = dom.editTitleInput.value.trim();
        const description = dom.editDescInput.value.trim();

        const marker = AppState.markers.find(m => m.id === id);
        if (marker) {
            marker.title = title;
            marker.description = description;
            actions.syncSceneMarkers?.();
            actions.selectMarker?.(id, false);
            dom.modalEdit.close();
            showToast('Markierung aktualisiert.', 'success');
        }
    });

    dom.cancelEditBtn?.addEventListener('click', () => {
        dom.modalEdit?.close();
    });

    // --- Tooltip Action Buttons ---
    dom.tooltipCloseBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        actions.selectMarker?.(null);
    });

    dom.tooltipFocusBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (AppState.selectedMarkerId) actions.selectMarker?.(AppState.selectedMarkerId, true);
    });

    dom.tooltipEditBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (AppState.selectedMarkerId) openEditModal(AppState.selectedMarkerId);
    });

    dom.tooltipDeleteBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (AppState.selectedMarkerId) deleteMarker(AppState.selectedMarkerId);
    });

    // Keyboard shortcut (Escape key deselects active marker and closes tooltip)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && AppState.selectedMarkerId) {
            actions.selectMarker?.(null);
        }
    });

    // --- Display & Render Options Drawer ---
    dom.textureToggle?.addEventListener('change', (e) => {
        AppState.useTexture = (e.target as HTMLInputElement).checked;
        if (AppState.boneModel) {
            AppState.boneModel.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh) {
                    mesh.material = AppState.useTexture ? boneMaterial : defaultMaterial;
                    (mesh.material as THREE.MeshStandardMaterial).wireframe = AppState.wireframeEnabled;
                }
            });
        }
        if (AppState.skinModel) {
            AppState.skinModel.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh) {
                    mesh.material = AppState.useTexture ? skinMaterial : defaultSkinMaterial;
                    (mesh.material as THREE.MeshStandardMaterial).wireframe = AppState.wireframeEnabled;
                }
            });
        }
    });

    dom.textureScaleSlider?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (dom.texScaleValSpan) dom.texScaleValSpan.textContent = `${val.toFixed(1)}x`;
        updateTextureScale(val);
        updateSkinTextureScale(val);
    });

    dom.wireframeToggle?.addEventListener('change', (e) => {
        AppState.wireframeEnabled = (e.target as HTMLInputElement).checked;
        boneMaterial.wireframe = AppState.wireframeEnabled;
        defaultMaterial.wireframe = AppState.wireframeEnabled;
        skinMaterial.wireframe = AppState.wireframeEnabled;
        defaultSkinMaterial.wireframe = AppState.wireframeEnabled;
        if (AppState.footModel) {
            AppState.footModel.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh && mesh.material) {
                    const mat = mesh.material as THREE.MeshStandardMaterial;
                    mat.wireframe = AppState.wireframeEnabled;
                }
            });
        }
    });

    dom.ambientLightSlider?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        ambientLight.intensity = val;
        if (dom.ambientValSpan) dom.ambientValSpan.textContent = val.toFixed(1);
    });

    dom.dirLightSlider?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        dirLight.intensity = val;
        if (dom.dirValSpan) dom.dirValSpan.textContent = val.toFixed(1);
    });

    dom.themeChips?.forEach(chip => {
        chip.addEventListener('click', () => {
            dom.themeChips.forEach(c => (c as HTMLElement).classList.remove('active'));
            (chip as HTMLElement).classList.add('active');
            const color = (chip as HTMLElement).dataset.color || '#0b0f17';
            scene.background = new THREE.Color(color);
            document.body.style.backgroundColor = color;
        });
    });

    dom.resetViewBtn?.addEventListener('click', () => actions.resetCameraView?.());

    // --- Panel Toggles (Sidebar & Options) ---
    dom.toggleSidebarBtn?.addEventListener('click', () => {
        dom.sidebar?.classList.toggle('collapsed');
        dom.toggleSidebarBtn?.classList.toggle('active', !dom.sidebar?.classList.contains('collapsed'));
    });

    dom.closeSidebarBtn?.addEventListener('click', () => {
        dom.sidebar?.classList.add('collapsed');
        dom.toggleSidebarBtn?.classList.remove('active');
    });

    dom.toggleOptionsBtn?.addEventListener('click', () => {
        dom.optionsDrawer?.classList.toggle('hidden');
        dom.toggleOptionsBtn?.classList.toggle('active', !dom.optionsDrawer?.classList.contains('hidden'));
    });

    dom.closeOptionsBtn?.addEventListener('click', () => {
        dom.optionsDrawer?.classList.add('hidden');
        dom.toggleOptionsBtn?.classList.remove('active');
    });

    // --- Export / Import Buttons ---
    dom.exportBtn?.addEventListener('click', () => {
        const ok = exportMarkersJSON();
        if (ok) {
            showToast('Markierungen als JSON exportiert!', 'success');
        } else {
            showToast('Keine Markierungen zum Exportieren vorhanden.', 'warning');
        }
    });

    dom.importBtn?.addEventListener('click', () => {
        if (dom.importFileInput) {
            dom.importFileInput.value = '';
            dom.importFileInput.click();
        }
    });

    dom.importFileInput?.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        importMarkersJSON(
            file,
            (importedMarkers) => {
                AppState.markers = importedMarkers;
                actions.syncSceneMarkers?.();
                actions.selectMarker?.(null);
                showToast(`${importedMarkers.length} Markierungen erfolgreich importiert!`, 'success');
            },
            (err) => {
                showToast('Fehler beim Importieren: ' + err.message, 'error');
            }
        );
    });

    dom.clearAllBtn?.addEventListener('click', () => {
        if (AppState.markers.length === 0) return;
        if (confirm('Möchtest du wirklich ALLE gesetzten Punkte unwiderruflich löschen?')) {
            AppState.markers = [];
            actions.selectMarker?.(null);
            actions.syncSceneMarkers?.();
            showToast('Alle Markierungen wurden gelöscht.', 'info');
        }
    });
}
