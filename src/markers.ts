import * as THREE from 'three';
import { camera, markersGroup } from './scene.js';
import { AppState } from './state.js';
import { saveMarkersToLocalStorage } from './storage.js';
import type { AnnotationMarker, ModelViewType } from './types.js';

// --- Marker Canvas Generators ---

/**
 * Creates dynamic 2D canvas texture for full numbered badge
 */
export function createBadgeCanvas(
    number: number,
    isActive = false,
    isHovered = false,
    view: ModelViewType = 'bone'
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const centerX = 128;
    const centerY = 128;
    const radius = 96;

    ctx.clearRect(0, 0, 256, 256);

    // Color definitions per view type
    const isSkin = view === 'skin';

    let glowColor: string;
    if (isSkin) {
        glowColor = isActive ? 'rgba(251, 146, 60, 1.0)' : (isHovered ? 'rgba(249, 115, 22, 0.95)' : 'rgba(234, 88, 12, 0.65)');
    } else {
        glowColor = isActive ? 'rgba(56, 189, 248, 1.0)' : (isHovered ? 'rgba(14, 165, 233, 0.9)' : 'rgba(2, 132, 199, 0.6)');
    }

    // Outer glow
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isActive ? 36 : (isHovered ? 28 : 18);

    // Gradient background circle
    const gradient = ctx.createLinearGradient(0, centerY - radius, 0, centerY + radius);
    if (isSkin) {
        if (isActive) {
            gradient.addColorStop(0, '#fb923c');
            gradient.addColorStop(1, '#ea580c');
        } else if (isHovered) {
            gradient.addColorStop(0, '#f97316');
            gradient.addColorStop(1, '#c2410c');
        } else {
            gradient.addColorStop(0, '#ea580c');
            gradient.addColorStop(1, '#271406');
        }
    } else {
        if (isActive) {
            gradient.addColorStop(0, '#38bdf8');
            gradient.addColorStop(1, '#0284c7');
        } else if (isHovered) {
            gradient.addColorStop(0, '#0ea5e9');
            gradient.addColorStop(1, '#0369a1');
        } else {
            gradient.addColorStop(0, '#0284c7');
            gradient.addColorStop(1, '#0f172a');
        }
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();

    // White rim border
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.lineWidth = isActive ? 12 : 8;
    ctx.strokeStyle = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();

    // Inner subtle ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 14, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.stroke();

    // Number label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.fillText(String(number), centerX, centerY + 4);

    return canvas;
}

/**
 * Creates dynamic 2D canvas texture for small glowing idle dot
 */
export function createDotCanvas(
    isActive = false,
    isHovered = false,
    view: ModelViewType = 'bone'
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const centerX = 64;
    const centerY = 64;
    const radius = 26;

    ctx.clearRect(0, 0, 128, 128);

    const isSkin = view === 'skin';

    let glowColor: string;
    let coreFill: string;
    if (isSkin) {
        glowColor = isActive ? 'rgba(251, 146, 60, 1.0)' : (isHovered ? 'rgba(249, 115, 22, 0.95)' : 'rgba(234, 88, 12, 0.7)');
        coreFill = isActive ? '#fb923c' : (isHovered ? '#f97316' : '#ea580c');
    } else {
        glowColor = isActive ? 'rgba(56, 189, 248, 1.0)' : (isHovered ? 'rgba(14, 165, 233, 0.95)' : 'rgba(2, 132, 199, 0.7)');
        coreFill = isActive ? '#38bdf8' : (isHovered ? '#0ea5e9' : '#0284c7');
    }

    // Outer glow
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isActive ? 24 : (isHovered ? 18 : 12);

    // Glowing core circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = coreFill;
    ctx.fill();
    ctx.restore();

    // White center pinpoint
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Crisp rim
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 6, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.5)';
    ctx.stroke();

    return canvas;
}

/**
 * Builds 3D visual hierarchy for a single marker
 */
export function createMarkerVisual(markerData: AnnotationMarker): { group: THREE.Group; sprite: THREE.Sprite } {
    const group = new THREE.Group();
    const markerView: ModelViewType = markerData.view || 'bone';
    const isCurrentView = markerView === AppState.activeView;

    group.userData = {
        markerId: markerData.id,
        number: markerData.number,
        view: markerView,
        isCurrentView
    };

    const scale = (AppState.modelBoundingSphere ? AppState.modelBoundingSphere.radius : 1.0) * 0.12;
    const isSkin = markerView === 'skin';
    const primaryColor = isSkin ? 0xfb923c : 0x38bdf8;

    // 1. Surface Anchor Dot
    const dotGeo = new THREE.SphereGeometry(scale * 0.08, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({
        color: primaryColor,
        transparent: true,
        opacity: isCurrentView ? 1.0 : 0.28,
        depthTest: false,
        depthWrite: false
    });
    const dotMesh = new THREE.Mesh(dotGeo, dotMat);
    dotMesh.position.set(0, 0, 0);
    dotMesh.renderOrder = isCurrentView ? 998 : 950;

    if (isCurrentView) {
        dotMesh.userData = { isMarkerAnchor: true, markerId: markerData.id };
    } else {
        dotMesh.userData = { isGhostAnchor: true, markerId: markerData.id };
    }
    group.add(dotMesh);

    // 2. Stem line connecting anchor to elevated badge (only visible in active view)
    const stemHeight = scale * 0.42;
    const lineMat = new THREE.LineBasicMaterial({
        color: primaryColor,
        transparent: true,
        opacity: 0.0,
        linewidth: 2,
        depthTest: false,
        depthWrite: false
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, stemHeight, 0)
    ]);
    const stemLine = new THREE.Line(lineGeo, lineMat);
    stemLine.renderOrder = isCurrentView ? 997 : 949;
    group.add(stemLine);

    // 3. Dual Textures: Full Badge & Minimalist Dot
    const badgeCanvas = createBadgeCanvas(markerData.number, markerData.id === AppState.selectedMarkerId, false, markerView);
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    badgeTex.minFilter = THREE.LinearFilter;

    const dotCanvas = createDotCanvas(markerData.id === AppState.selectedMarkerId, false, markerView);
    const dotTex = new THREE.CanvasTexture(dotCanvas);
    dotTex.colorSpace = THREE.SRGBColorSpace;
    dotTex.minFilter = THREE.LinearFilter;

    markerData.badgeTexture = badgeTex;
    markerData.dotTexture = dotTex;

    const isInitiallySelected = isCurrentView && (markerData.id === AppState.selectedMarkerId);

    const spriteMat = new THREE.SpriteMaterial({
        map: isInitiallySelected ? badgeTex : dotTex,
        transparent: true,
        opacity: isCurrentView ? (isInitiallySelected ? 1.0 : 1.0) : 0.22,
        depthTest: false,
        depthWrite: false
    });

    const initScale = isCurrentView ? (isInitiallySelected ? scale : scale * 0.32) : scale * 0.22;
    const initY = isCurrentView ? (isInitiallySelected ? stemHeight : scale * 0.06) : scale * 0.05;

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(initScale, initScale, 1);
    sprite.position.set(0, initY, 0);
    sprite.renderOrder = isCurrentView ? 999 : 951;

    if (isCurrentView) {
        sprite.userData = { isMarkerSprite: true, markerId: markerData.id };
    } else {
        sprite.userData = { isGhostSprite: true, markerId: markerData.id };
    }
    group.add(sprite);

    // 4. Invisible generous hit sphere for effortless hover & click detection (active view only!)
    let hitMesh: THREE.Mesh | undefined;
    if (isCurrentView) {
        const hitGeo = new THREE.SphereGeometry(scale * 0.45, 8, 8);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.position.set(0, scale * 0.2, 0);
        hitMesh.userData = { isMarkerHitTarget: true, markerId: markerData.id };
        group.add(hitMesh);
    }

    markerData.sprite = sprite;
    markerData.stemLine = stemLine;
    markerData.dotMesh = dotMesh;
    markerData.hitMesh = hitMesh;
    markerData.isOccluded = false;

    // Position whole group at marker coordinates and orient along normal
    group.position.set(markerData.position.x, markerData.position.y, markerData.position.z);
    
    if (markerData.normal) {
        const normalVec = new THREE.Vector3(markerData.normal.x, markerData.normal.y, markerData.normal.z).normalize();
        const upVec = new THREE.Vector3(0, 1, 0);
        group.quaternion.setFromUnitVectors(upVec, normalVec);
    }

    return { group, sprite };
}

/**
 * Updates textures for a marker when active/selected status changes
 */
export function updateMarkerBadgeTexture(markerId: string, isActive = false, isHovered = false): void {
    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker) return;

    const markerView = marker.view || 'bone';

    if (marker.badgeTexture) {
        const badgeCanvas = createBadgeCanvas(marker.number, isActive, isHovered, markerView);
        marker.badgeTexture.image = badgeCanvas;
        marker.badgeTexture.needsUpdate = true;
    }
    if (marker.dotTexture) {
        const dotCanvas = createDotCanvas(isActive, isHovered, markerView);
        marker.dotTexture.image = dotCanvas;
        marker.dotTexture.needsUpdate = true;
    }
}

// --- Occlusion Detection ---
const _camPos = new THREE.Vector3();
const _markerPos = new THREE.Vector3();
const _viewDir = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _lastCamPos = new THREE.Vector3();
const _lastCamRot = new THREE.Quaternion();

/**
 * Real-time analytical occlusion test based on surface normal vectors
 */
export function updateMarkerOcclusion(): void {
    if (!AppState.footModel || AppState.markers.length === 0) return;

    // Fast return if camera has not moved
    if (camera.position.equals(_lastCamPos) && camera.quaternion.equals(_lastCamRot)) {
        return;
    }
    _lastCamPos.copy(camera.position);
    _lastCamRot.copy(camera.quaternion);

    camera.getWorldPosition(_camPos);

    AppState.markers.forEach(marker => {
        if (!marker.threeGroup) return;

        marker.threeGroup.getWorldPosition(_markerPos);
        _viewDir.subVectors(_camPos, _markerPos).normalize();

        // High-speed normal orientation test:
        // A surface point is occluded when its surface normal faces away from the camera
        if (marker.normal) {
            _normal.set(marker.normal.x, marker.normal.y, marker.normal.z).normalize();
            marker.isOccluded = (_normal.dot(_viewDir) < 0.0);
        } else {
            marker.isOccluded = false;
        }
    });

    // Update floating tooltip card transparency if active marker is occluded
    if (AppState.selectedMarkerId) {
        const activeMarker = AppState.markers.find(m => m.id === AppState.selectedMarkerId);
        if (activeMarker) {
            const floatingTooltip = typeof document !== 'undefined' ? document.getElementById('floating-tooltip') : null;
            if (floatingTooltip) {
                if (activeMarker.isOccluded) {
                    floatingTooltip.classList.add('occluded');
                } else {
                    floatingTooltip.classList.remove('occluded');
                }
            }
        }
    }
}

// Event listener callback registry for scene sync events
const onMarkersChangedCallbacks: Array<() => void> = [];

/**
 * Registers a callback invoked whenever markers are synced or updated
 */
export function onMarkersChanged(cb: () => void): void {
    if (typeof cb === 'function') {
        onMarkersChangedCallbacks.push(cb);
    }
}

/**
 * Rebuilds all 3D markers from AppState.markers
 */
export function syncSceneMarkers(): void {
    // Clear existing children
    while (markersGroup.children.length > 0) {
        const child = markersGroup.children[0];
        child.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                const mat = mesh.material as THREE.Material & { map?: THREE.Texture };
                if (mat.map) mat.map.dispose();
                mat.dispose();
            }
        });
        markersGroup.remove(child);
    }

    // Separate sequential numbering per view
    const boneMarkers = AppState.markers.filter(m => (m.view || 'bone') === 'bone');
    const skinMarkers = AppState.markers.filter(m => (m.view || 'bone') === 'skin');
    boneMarkers.forEach((m, idx) => { m.number = idx + 1; });
    skinMarkers.forEach((m, idx) => { m.number = idx + 1; });

    // Build new 3D marker hierarchies
    AppState.markers.forEach((markerData) => {
        const { group } = createMarkerVisual(markerData);
        markerData.threeGroup = group;
        markersGroup.add(group);
    });

    // Cache interactive marker components for instantaneous raycasting (ACTIVE VIEW ONLY!)
    AppState.interactiveMarkerObjects = [];
    markersGroup.children.forEach(group => {
        if (group.userData?.view !== AppState.activeView) return;

        group.children.forEach(child => {
            const mesh = child as THREE.Mesh;
            if (child instanceof THREE.Sprite && child.userData?.isMarkerSprite) {
                AppState.interactiveMarkerObjects.push(child);
            } else if (mesh.isMesh && mesh.userData && (mesh.userData.isMarkerAnchor || mesh.userData.isMarkerHitTarget)) {
                AppState.interactiveMarkerObjects.push(child);
            }
        });
    });

    saveMarkersToLocalStorage();

    // Notify registered UI listeners
    onMarkersChangedCallbacks.forEach(cb => {
        try {
            cb();
        } catch (e) {
            console.error('Marker sync callback error:', e);
        }
    });
}
