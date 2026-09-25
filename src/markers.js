import * as THREE from 'three';
import { camera, markersGroup } from './scene.js';
import { AppState } from './state.js';
import { saveMarkersToLocalStorage } from './storage.js';

// --- Marker Canvas Generators ---

/**
 * Creates dynamic 2D canvas texture for full numbered badge
 * @param {number} number 
 * @param {boolean} isActive 
 * @param {boolean} isHovered 
 * @returns {HTMLCanvasElement}
 */
export function createBadgeCanvas(number, isActive = false, isHovered = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const centerX = 128;
    const centerY = 128;
    const radius = 96;

    ctx.clearRect(0, 0, 256, 256);

    // Outer glow
    ctx.save();
    ctx.shadowColor = isActive ? 'rgba(56, 189, 248, 1.0)' : (isHovered ? 'rgba(14, 165, 233, 0.9)' : 'rgba(2, 132, 199, 0.6)');
    ctx.shadowBlur = isActive ? 36 : (isHovered ? 28 : 18);

    // Gradient background circle
    const gradient = ctx.createLinearGradient(0, centerY - radius, 0, centerY + radius);
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
 * @param {boolean} isActive 
 * @param {boolean} isHovered 
 * @returns {HTMLCanvasElement}
 */
export function createDotCanvas(isActive = false, isHovered = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const centerX = 64;
    const centerY = 64;
    const radius = 26;

    ctx.clearRect(0, 0, 128, 128);

    // Outer glow
    ctx.save();
    ctx.shadowColor = isActive ? 'rgba(56, 189, 248, 1.0)' : (isHovered ? 'rgba(14, 165, 233, 0.95)' : 'rgba(2, 132, 199, 0.7)');
    ctx.shadowBlur = isActive ? 24 : (isHovered ? 18 : 12);

    // Glowing core circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? '#38bdf8' : (isHovered ? '#0ea5e9' : '#0284c7');
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
 * @param {object} markerData 
 * @returns {{group: THREE.Group, sprite: THREE.Sprite}}
 */
export function createMarkerVisual(markerData) {
    const group = new THREE.Group();
    group.userData = { markerId: markerData.id, number: markerData.number };

    const scale = (AppState.modelBoundingSphere ? AppState.modelBoundingSphere.radius : 1.0) * 0.12;

    // 1. Surface Anchor Dot
    const dotGeo = new THREE.SphereGeometry(scale * 0.08, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 1.0,
        depthTest: false,
        depthWrite: false
    });
    const dotMesh = new THREE.Mesh(dotGeo, dotMat);
    dotMesh.position.set(0, 0, 0);
    dotMesh.renderOrder = 998;
    dotMesh.userData = { isMarkerAnchor: true, markerId: markerData.id };
    group.add(dotMesh);

    // 2. Stem line connecting anchor to elevated badge
    const stemHeight = scale * 0.42;
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
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
    stemLine.renderOrder = 997;
    group.add(stemLine);

    // 3. Dual Textures: Full Badge & Minimalist Dot
    const badgeCanvas = createBadgeCanvas(markerData.number, markerData.id === AppState.selectedMarkerId);
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    badgeTex.minFilter = THREE.LinearFilter;

    const dotCanvas = createDotCanvas(markerData.id === AppState.selectedMarkerId);
    const dotTex = new THREE.CanvasTexture(dotCanvas);
    dotTex.colorSpace = THREE.SRGBColorSpace;
    dotTex.minFilter = THREE.LinearFilter;

    markerData.badgeTexture = badgeTex;
    markerData.dotTexture = dotTex;

    const isInitiallySelected = (markerData.id === AppState.selectedMarkerId);

    const spriteMat = new THREE.SpriteMaterial({
        map: isInitiallySelected ? badgeTex : dotTex,
        transparent: true,
        opacity: 1.0,
        depthTest: false,
        depthWrite: false
    });

    const initScale = isInitiallySelected ? scale : scale * 0.32;
    const initY = isInitiallySelected ? stemHeight : scale * 0.06;

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(initScale, initScale, 1);
    sprite.position.set(0, initY, 0);
    sprite.renderOrder = 999;
    sprite.userData = { isMarkerSprite: true, markerId: markerData.id };
    group.add(sprite);

    // 4. Invisible generous hit sphere for effortless hover & click detection
    const hitGeo = new THREE.SphereGeometry(scale * 0.45, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.set(0, scale * 0.2, 0);
    hitMesh.userData = { isMarkerHitTarget: true, markerId: markerData.id };
    group.add(hitMesh);

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
 * @param {string} markerId 
 * @param {boolean} isActive 
 * @param {boolean} isHovered 
 */
export function updateMarkerBadgeTexture(markerId, isActive = false, isHovered = false) {
    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker) return;

    if (marker.badgeTexture) {
        const badgeCanvas = createBadgeCanvas(marker.number, isActive, isHovered);
        marker.badgeTexture.image = badgeCanvas;
        marker.badgeTexture.needsUpdate = true;
    }
    if (marker.dotTexture) {
        const dotCanvas = createDotCanvas(isActive, isHovered);
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
export function updateMarkerOcclusion() {
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
            const floatingTooltip = document.getElementById('floating-tooltip');
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
let onMarkersChangedCallbacks = [];

/**
 * Registers a callback invoked whenever markers are synced or updated
 * @param {Function} cb 
 */
export function onMarkersChanged(cb) {
    if (typeof cb === 'function') {
        onMarkersChangedCallbacks.push(cb);
    }
}

/**
 * Rebuilds all 3D markers from AppState.markers
 */
export function syncSceneMarkers() {
    // Clear existing children
    while (markersGroup.children.length > 0) {
        const child = markersGroup.children[0];
        child.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        });
        markersGroup.remove(child);
    }

    // Build new 3D marker hierarchies
    AppState.markers.forEach((markerData, index) => {
        markerData.number = index + 1; // ensure 1-based sequential numbering
        const { group } = createMarkerVisual(markerData);
        markerData.threeGroup = group;
        markersGroup.add(group);
    });

    // Cache interactive marker components for instantaneous raycasting
    AppState.interactiveMarkerObjects = [];
    markersGroup.children.forEach(group => {
        group.children.forEach(child => {
            if (child.isSprite || (child.isMesh && child.userData && (child.userData.isMarkerAnchor || child.userData.isMarkerHitTarget))) {
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
