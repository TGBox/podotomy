import * as THREE from 'three';
import { camera } from './scene.js';
import { AppState } from './state.js';
import { updateMarkerBadgeTexture } from './markers.js';
import { flyToPosition, resetCameraView } from './camera.js';
import { dom, updateSidebarCardHighlight, openAddModal, showToast } from './ui.js';

export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();

const _normalMatrix = new THREE.Matrix3();

/**
 * Converts the hit face normal from object-local space into world space
 * (required for rotated/scaled models such as the skin mesh)
 */
export function getWorldHitNormal(hit: THREE.Intersection): THREE.Vector3 | null {
    if (!hit.face) return null;
    _normalMatrix.getNormalMatrix(hit.object.matrixWorld);
    return hit.face.normal.clone().applyMatrix3(_normalMatrix).normalize();
}

/**
 * Selects an annotation marker, opens its floating tooltip, highlights sidebar, and flies camera
 */
export function selectMarker(markerId: string | null, smoothFly = true): void {
    if (AppState.selectedMarkerId) {
        updateMarkerBadgeTexture(AppState.selectedMarkerId, false);
    }

    AppState.selectedMarkerId = markerId;

    if (!markerId) {
        if (dom.floatingTooltip) {
            dom.floatingTooltip.classList.remove('visible');
            dom.floatingTooltip.style.display = 'none';
        }
        updateSidebarCardHighlight(null);
        return;
    }

    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker) {
        if (dom.floatingTooltip) {
            dom.floatingTooltip.classList.remove('visible');
            dom.floatingTooltip.style.display = 'none';
        }
        updateSidebarCardHighlight(null);
        return;
    }

    updateMarkerBadgeTexture(markerId, true);
    updateSidebarCardHighlight(markerId);

    // Update Floating Tooltip Content
    if (dom.tooltipBadge) dom.tooltipBadge.textContent = String(marker.number);
    if (dom.tooltipTitle) dom.tooltipTitle.textContent = marker.title;
    if (dom.tooltipDesc) dom.tooltipDesc.textContent = marker.description || 'Keine Notiz vorhanden.';
    if (dom.floatingTooltip) {
        const isSkin = (marker.view || 'bone') === 'skin';
        dom.floatingTooltip.classList.toggle('skin-tooltip', isSkin);
        dom.floatingTooltip.style.display = 'block';
        dom.floatingTooltip.classList.add('visible');
    }

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
export function updateFloatingTooltipPosition(): void {
    if (!AppState.selectedMarkerId || !dom.floatingTooltip?.classList.contains('visible')) {
        if (dom.floatingTooltip) dom.floatingTooltip.style.display = 'none';
        return;
    }

    const marker = AppState.markers.find(m => m.id === AppState.selectedMarkerId);
    if (!marker || !marker.threeGroup) {
        dom.floatingTooltip.classList.remove('visible');
        dom.floatingTooltip.style.display = 'none';
        return;
    }

    // Get position of the elevated badge
    const sprite = marker.threeGroup.children.find(c => c instanceof THREE.Sprite);
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
 */
export function getMarkerInteractiveObjects(): THREE.Object3D[] {
    return AppState.interactiveMarkerObjects || [];
}

/**
 * Initializes pointer interaction handlers (hover, click, drag, double-click)
 */
export function setupInteractions(): void {
    if (typeof window === 'undefined') return;

    let isPointerDown = false;
    let pointerDownPos = { x: 0, y: 0 };

    window.addEventListener('pointerdown', (e: PointerEvent) => {
        isPointerDown = true;
        pointerDownPos = { x: e.clientX, y: e.clientY };
        AppState.isDragging = false;
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
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

        const target = e.target as HTMLElement | null;
        // Ignore marker hover if over UI panels
        if (target && (
            target.closest('.top-nav') ||
            target.closest('.sidebar') ||
            target.closest('.options-drawer') ||
            target.closest('#floating-tooltip') ||
            target.closest('dialog') ||
            target.closest('.toast-container')
        )) {
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
            const newHoveredId = hitMarkers.length > 0 ? (hitMarkers[0].object.userData?.markerId as string) || null : null;

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

    window.addEventListener('pointerup', (e: PointerEvent) => {
        const wasDragging = AppState.isDragging;
        isPointerDown = false;
        AppState.isDragging = false;

        // Ignore if user was rotating/panning the view
        if (wasDragging) return;

        const target = e.target as HTMLElement | null;
        // Ignore clicks on UI overlays
        if (target && (
            target.closest('.top-nav') ||
            target.closest('.sidebar') ||
            target.closest('.options-drawer') ||
            target.closest('#floating-tooltip') ||
            target.closest('dialog') ||
            target.closest('.toast-container')
        )) {
            return;
        }

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        // 1. Check if an existing marker was clicked (badge sprite, anchor dot or hit sphere)
        const markerHits = raycaster.intersectObjects(getMarkerInteractiveObjects());

        if (markerHits.length > 0) {
            const clickedObj = markerHits[0].object;
            const markerId = clickedObj.userData?.markerId as string;
            if (markerId) {
                selectMarker(markerId, true);
                return;
            }
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
                        normal: getWorldHitNormal(hit) ?? new THREE.Vector3(0, 1, 0)
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
    window.addEventListener('dblclick', (e: MouseEvent) => {
        if (AppState.mode !== 'navigate') return;
        const target = e.target as HTMLElement | null;
        if (target && (
            target.closest('.top-nav') ||
            target.closest('.sidebar') ||
            target.closest('.options-drawer') ||
            target.closest('#floating-tooltip') ||
            target.closest('dialog') ||
            target.closest('.toast-container')
        )) {
            return;
        }

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        if (AppState.footModel) {
            const hits = raycaster.intersectObject(AppState.footModel, true);
            if (hits.length > 0) {
                flyToPosition(hits[0].point, getWorldHitNormal(hits[0]), 600);
                showToast('Drehpunkt auf markierte Stelle zentriert', 'info');
            } else {
                resetCameraView();
            }
        }
    });
}
