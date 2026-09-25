import * as THREE from 'three';
import { camera } from './scene.js';
import { AppState } from './state.js';
import { updateMarkerBadgeTexture } from './markers.js';
import { flyToPosition, resetCameraView } from './camera.js';
import { dom, updateSidebarCardHighlight, openAddModal, showToast } from './ui.js';

export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();

/**
 * Selects an annotation marker, opens its floating tooltip, highlights sidebar, and flies camera
 * @param {string|null} markerId 
 * @param {boolean} smoothFly 
 */
export function selectMarker(markerId, smoothFly = true) {
    if (AppState.selectedMarkerId) {
        updateMarkerBadgeTexture(AppState.selectedMarkerId, false);
    }

    AppState.selectedMarkerId = markerId;

    if (!markerId) {
        dom.floatingTooltip.classList.remove('visible');
        dom.floatingTooltip.style.display = 'none';
        updateSidebarCardHighlight(null);
        return;
    }

    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker) {
        dom.floatingTooltip.classList.remove('visible');
        dom.floatingTooltip.style.display = 'none';
        updateSidebarCardHighlight(null);
        return;
    }

    updateMarkerBadgeTexture(markerId, true);
    updateSidebarCardHighlight(markerId);

    // Update Floating Tooltip Content
    dom.tooltipBadge.textContent = String(marker.number);
    dom.tooltipTitle.textContent = marker.title;
    dom.tooltipDesc.textContent = marker.description || 'Keine Notiz vorhanden.';
    dom.floatingTooltip.style.display = 'block';
    dom.floatingTooltip.classList.add('visible');

    // Fly camera if requested
    if (smoothFly && marker.threeGroup) {
        const targetPos = marker.threeGroup.position.clone();
        const normal = marker.normal ? new THREE.Vector3(marker.normal.x, marker.normal.y, marker.normal.z) : null;
        flyToPosition(targetPos, normal, 800);
    }
}

// Reusable vectors for 2D screen projection to prevent garbage collection churn
const _tooltipBadgePos = new THREE.Vector3();
const _tooltipProjVector = new THREE.Vector3();

/**
 * Positions floating card above active marker in 2D viewport coordinates
 */
export function updateFloatingTooltipPosition() {
    if (!AppState.selectedMarkerId || !dom.floatingTooltip.classList.contains('visible')) {
        dom.floatingTooltip.style.display = 'none';
        return;
    }

    const marker = AppState.markers.find(m => m.id === AppState.selectedMarkerId);
    if (!marker || !marker.threeGroup) {
        dom.floatingTooltip.classList.remove('visible');
        dom.floatingTooltip.style.display = 'none';
        return;
    }

    // Get position of the elevated badge
    const sprite = marker.threeGroup.children.find(c => c.isSprite);
    if (sprite) {
        sprite.getWorldPosition(_tooltipBadgePos);
    } else {
        marker.threeGroup.getWorldPosition(_tooltipBadgePos);
    }

    // Project to screen coordinates
    _tooltipProjVector.copy(_tooltipBadgePos).project(camera);

    // Hide if behind camera frustum plane
    if (_tooltipProjVector.z > 1) {
        dom.floatingTooltip.style.display = 'none';
        return;
    }

    dom.floatingTooltip.style.display = 'block';
    const x = (_tooltipProjVector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(_tooltipProjVector.y * 0.5) + 0.5) * window.innerHeight;

    dom.floatingTooltip.style.left = `${Math.round(x)}px`;
    dom.floatingTooltip.style.top = `${Math.round(y)}px`;
}

/**
 * Returns all active interactive components for raycasting
 * @returns {Array<THREE.Object3D>}
 */
export function getMarkerInteractiveObjects() {
    return AppState.interactiveMarkerObjects || [];
}

/**
 * Initializes pointer interaction handlers (hover, click, drag, double-click)
 */
export function setupInteractions() {
    let isPointerDown = false;
    let pointerDownPos = { x: 0, y: 0 };

    window.addEventListener('pointerdown', (e) => {
        isPointerDown = true;
        pointerDownPos = { x: e.clientX, y: e.clientY };
        AppState.isDragging = false;
    });

    window.addEventListener('pointermove', (e) => {
        // Only mark dragging if mouse button is held down
        if (isPointerDown && e.buttons !== 0) {
            const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
            if (dist > 4) {
                AppState.isDragging = true;
            }
        } else {
            isPointerDown = false;
            AppState.isDragging = false;
        }

        // Ignore marker hover if over UI panels
        if (e.target.closest('.top-nav') ||
            e.target.closest('.sidebar') ||
            e.target.closest('.options-drawer') ||
            e.target.closest('#floating-tooltip') ||
            e.target.closest('dialog') ||
            e.target.closest('.toast-container')) {
            if (AppState.hoveredMarkerId !== null) {
                AppState.hoveredMarkerId = null;
            }
            document.body.style.cursor = 'default';
            return;
        }

        // Skip hover tests while actively dragging to maintain 60 FPS
        if (AppState.isDragging) return;

        // Hover test in Navigate mode
        if (AppState.mode === 'navigate') {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            const hitMarkers = raycaster.intersectObjects(getMarkerInteractiveObjects());
            const newHoveredId = hitMarkers.length > 0 ? hitMarkers[0].object.userData.markerId : null;

            if (newHoveredId !== AppState.hoveredMarkerId) {
                AppState.hoveredMarkerId = newHoveredId;
            }

            if (AppState.hoveredMarkerId) {
                document.body.style.cursor = 'pointer';
            } else {
                document.body.style.cursor = 'default';
            }
        }
    });

    window.addEventListener('pointerleave', () => {
        isPointerDown = false;
        AppState.isDragging = false;
        if (AppState.hoveredMarkerId !== null) {
            AppState.hoveredMarkerId = null;
            document.body.style.cursor = 'default';
        }
    });

    window.addEventListener('pointerup', (e) => {
        const wasDragging = AppState.isDragging;
        isPointerDown = false;
        AppState.isDragging = false;

        // Ignore if user was rotating/panning the view
        if (wasDragging) return;

        // Ignore clicks on UI overlays
        if (e.target.closest('.top-nav') ||
            e.target.closest('.sidebar') ||
            e.target.closest('.options-drawer') ||
            e.target.closest('#floating-tooltip') ||
            e.target.closest('dialog') ||
            e.target.closest('.toast-container')) {
            return;
        }

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        // 1. Check if an existing marker was clicked (badge sprite, anchor dot or hit sphere)
        const markerHits = raycaster.intersectObjects(getMarkerInteractiveObjects());

        if (markerHits.length > 0) {
            const clickedObj = markerHits[0].object;
            const markerId = clickedObj.userData.markerId;
            selectMarker(markerId, true);
            return;
        }

        // 2. Check if foot model surface was clicked
        if (AppState.footModel) {
            const modelHits = raycaster.intersectObject(AppState.footModel, true);
            if (modelHits.length > 0) {
                const hit = modelHits[0];

                if (AppState.mode === 'add') {
                    // Open Add Marker Modal
                    AppState.pendingHit = {
                        point: hit.point.clone(),
                        normal: hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0)
                    };
                    openAddModal();
                    return;
                } else {
                    // In navigate mode, clicking the foot deselects current marker
                    selectMarker(null);
                }
            } else {
                // Clicked in empty space -> deselect
                selectMarker(null);
            }
        }
    });

    // Double click: smoothly center rotation pivot on clicked bone surface point
    window.addEventListener('dblclick', (e) => {
        if (AppState.mode !== 'navigate') return;
        if (e.target.closest('.top-nav') ||
            e.target.closest('.sidebar') ||
            e.target.closest('.options-drawer') ||
            e.target.closest('#floating-tooltip') ||
            e.target.closest('dialog') ||
            e.target.closest('.toast-container')) {
            return;
        }

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        if (AppState.footModel) {
            const hits = raycaster.intersectObject(AppState.footModel, true);
            if (hits.length > 0) {
                flyToPosition(hits[0].point, hits[0].face ? hits[0].face.normal : null, 600);
                showToast('Drehpunkt auf markierte Stelle zentriert', 'info');
            } else {
                resetCameraView();
            }
        }
    });
}
