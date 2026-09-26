import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AppState } from './state.js';
import { scene, camera, renderer, controls } from './scene.js';
import { boneMaterial, defaultMaterial, generateBoxUVs } from './materials.js';
import { syncSceneMarkers, updateMarkerOcclusion, onMarkersChanged } from './markers.js';
import { resetCameraView } from './camera.js';
import { loadMarkersFromLocalStorage } from './storage.js';
import { dom, initUI, updateSidebarList, updateMarkerCounts, showToast } from './ui.js';
import { setupInteractions, selectMarker, updateFloatingTooltipPosition } from './interactions.js';

/**
 * Computes anatomical centroid of the foot body (ignoring upper protruding shin bone)
 */
export function getFootCentroid(model: THREE.Object3D): THREE.Vector3 {
    let sumX = 0, sumY = 0, sumZ = 0;
    let samples = 0;
    model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
            const pos = mesh.geometry.attributes.position;
            if (!pos) return;
            const count = pos.count;
            const step = Math.max(1, Math.floor(count / 25000));
            for (let i = 0; i < count; i += step) {
                sumX += pos.getX(i);
                sumY += pos.getY(i);
                sumZ += pos.getZ(i);
                samples++;
            }
        }
    });
    if (samples === 0) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(sumX / samples, sumY / samples, sumZ / samples);
}

/**
 * Loads bones_foot.glb, centers the model, generates UVs, frames camera, and loads markers
 */
export function loadModel(): void {
    const loader = new GLTFLoader();
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ? import.meta.env.BASE_URL.replace(/\/$/, '') : '';
    const modelUrl = `${base}/bones_foot.glb`;
    const estimatedTotalBytes = 40605948; // ~38.7 MB

    loader.load(
        modelUrl,
        (gltf) => {
            AppState.footModel = gltf.scene;

            // Center foot based on vertex density inside the foot body
            const footCenter = getFootCentroid(AppState.footModel);
            AppState.footModel.position.sub(footCenter);
            AppState.footModel.updateMatrixWorld(true);

            // Compute bounding sphere after centering for auto-framing
            const box = new THREE.Box3().setFromObject(AppState.footModel);
            const sphere = box.getBoundingSphere(new THREE.Sphere());
            AppState.modelBoundingSphere = sphere;

            // Generate Tri-Planar Box UVs and apply bone material
            AppState.footModel.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh && mesh.geometry) {
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    generateBoxUVs(mesh.geometry, 0.02);
                    mesh.material = AppState.useTexture ? boneMaterial : defaultMaterial;
                    const mat = mesh.material as THREE.MeshStandardMaterial;
                    mat.wireframe = AppState.wireframeEnabled;
                }
            });

            scene.add(AppState.footModel);

            // Camera framing
            const radius = sphere.radius;
            const dist = radius * 2.0;
            // Upright foot orientation: Y is UP, Z is length, X is width
            AppState.initialCameraPosition.set(dist * 0.65, dist * 0.45, dist * 0.85);
            AppState.initialCameraTarget.set(0, 0, 0);

            camera.position.copy(AppState.initialCameraPosition);
            camera.up.set(0, 1, 0);
            controls.target.copy(AppState.initialCameraTarget);
            controls.maxDistance = radius * 6;
            controls.minDistance = radius * 0.2;
            controls.update();

            // Load saved markers from LocalStorage and build 3D visual groups
            loadMarkersFromLocalStorage();
            syncSceneMarkers();

            // Fade out loading screen
            setTimeout(() => {
                dom.loadingOverlay?.classList.add('fade-out');
            }, 300);
        },
        (xhr) => {
            const total = xhr.total > 0 ? xhr.total : estimatedTotalBytes;
            const percent = Math.min(Math.round((xhr.loaded / total) * 100), 100);
            if (dom.progressBar) dom.progressBar.style.width = `${percent}%`;
            if (dom.progressPercent) dom.progressPercent.textContent = `${percent}%`;
            const loadedMb = (xhr.loaded / (1024 * 1024)).toFixed(1);
            const totalMb = (total / (1024 * 1024)).toFixed(1);
            if (dom.progressBytes) dom.progressBytes.textContent = `${loadedMb} MB / ${totalMb} MB`;
        },
        (error) => {
            console.error('Error loading 3D model:', error);
            showToast('Fehler beim Laden von bones_foot.glb', 'error');
            if (dom.progressBytes) dom.progressBytes.textContent = 'Fehler beim Laden!';
        }
    );
}

/**
 * Main WebGL rendering loop running at 60 FPS
 */
export function animate(time: number): void {
    requestAnimationFrame(animate);

    // Camera fly animation tween
    if (AppState.cameraAnimation) {
        AppState.cameraAnimation.update(time);
    } else {
        controls.update();
    }

    // 1. High-speed occlusion check (tests if markers are on the back side)
    updateMarkerOcclusion();

    // 2. Animate marker visuals: idle small dot vs expanded numbered badge, occlusion transparency, lerping
    const baseRadius = (AppState.modelBoundingSphere ? AppState.modelBoundingSphere.radius : 1.0);
    const markerScale = baseRadius * 0.12;
    const stemHeight = markerScale * 0.42;

    AppState.markers.forEach(marker => {
        if (!marker.threeGroup) return;

        const sprite = marker.sprite;
        const stemLine = marker.stemLine;
        const dotMesh = marker.dotMesh;
        if (!sprite) return;

        const isSelected = (marker.id === AppState.selectedMarkerId);
        const isHovered = (marker.id === AppState.hoveredMarkerId);
        const isExpanded = isSelected || isHovered;
        const isOccluded = !!marker.isOccluded;

        // Texture swap: expanded shows full badge with number; idle shows glowing dot
        const targetTexture = isExpanded ? marker.badgeTexture : marker.dotTexture;
        if (sprite.material.map !== targetTexture && targetTexture) {
            sprite.material.map = targetTexture;
            sprite.material.needsUpdate = true;
        }

        // Target scale & position
        let targetScale = isExpanded ? markerScale : markerScale * 0.32;
        if (isSelected) {
            targetScale *= (1.0 + 0.06 * Math.sin(time * 0.006));
        }
        const targetY = isExpanded ? stemHeight : markerScale * 0.06;

        // Target opacities:
        // Occluded (behind foot): ~0.25 (idle dot) or ~0.45 (expanded/hovered)
        // Visible (front of foot): 1.0
        let targetSpriteOpacity: number;
        if (isOccluded) {
            targetSpriteOpacity = isExpanded ? 0.45 : 0.25;
        } else {
            targetSpriteOpacity = 1.0;
        }

        const targetStemOpacity = isExpanded ? (isOccluded ? 0.25 : 0.85) : 0.0;
        const targetDotOpacity = isOccluded ? 0.28 : 1.0;

        // Smooth lerping for fluid visual transition
        const lerpFactor = 0.2;
        sprite.scale.x += (targetScale - sprite.scale.x) * lerpFactor;
        sprite.scale.y += (targetScale - sprite.scale.y) * lerpFactor;
        sprite.position.y += (targetY - sprite.position.y) * lerpFactor;

        sprite.material.opacity += (targetSpriteOpacity - sprite.material.opacity) * lerpFactor;
        if (stemLine && !Array.isArray(stemLine.material)) {
            const lineMat = stemLine.material as THREE.LineBasicMaterial;
            lineMat.opacity += (targetStemOpacity - lineMat.opacity) * lerpFactor;
        }
        if (dotMesh && !Array.isArray(dotMesh.material)) {
            const dotMat = dotMesh.material as THREE.MeshBasicMaterial;
            dotMat.opacity += (targetDotOpacity - dotMat.opacity) * lerpFactor;
        }
    });

    // 3. Update floating 2D tooltip screen position
    updateFloatingTooltipPosition();

    // 4. Render 3D Scene
    renderer.render(scene, camera);
}

// --- Application Bootstrap ---
if (typeof window !== 'undefined') {
    onMarkersChanged(() => {
        updateSidebarList();
        updateMarkerCounts();
    });

    initUI({
        selectMarker,
        syncSceneMarkers,
        resetCameraView
    });

    setupInteractions();
    loadModel();
    animate(0);
}
