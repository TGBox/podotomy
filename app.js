import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- State Management ---
const AppState = {
    mode: 'navigate', // 'navigate' | 'add'
    markers: [],
    selectedMarkerId: null,
    footModel: null,
    modelBoundingSphere: null,
    initialCameraPosition: new THREE.Vector3(140, 100, 200),
    initialCameraTarget: new THREE.Vector3(0, 0, 0),
    isDragging: false,
    cameraAnimation: null,
    pendingHit: null,
    wireframeEnabled: false,
    useTexture: true,
    textureScale: 1.0,
    modelScaleFactor: 1.0,
    searchQuery: '',
    storageKey: 'podotomy_foot_annotations_v2'
};

// --- DOM Elements ---
const canvasContainer = document.getElementById('canvas-container');
const modeNavBtn = document.getElementById('mode-nav-btn');
const modeAddBtn = document.getElementById('mode-add-btn');
const modeBanner = document.getElementById('mode-banner');
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const optionsDrawer = document.getElementById('options-drawer');
const toggleOptionsBtn = document.getElementById('toggle-options-btn');
const closeOptionsBtn = document.getElementById('close-options-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
const markersList = document.getElementById('markers-list');
const markerCountBadge = document.getElementById('marker-count-badge');
const sidebarCountPill = document.getElementById('sidebar-count-pill');
const searchInput = document.getElementById('search-input');
const exportBtn = document.getElementById('export-json-btn');
const importBtn = document.getElementById('import-json-btn');
const importFileInput = document.getElementById('import-file-input');
const clearAllBtn = document.getElementById('clear-all-btn');

// Floating Tooltip
const floatingTooltip = document.getElementById('floating-tooltip');
const tooltipBadge = document.getElementById('tooltip-badge');
const tooltipTitle = document.getElementById('tooltip-title');
const tooltipDesc = document.getElementById('tooltip-desc');
const tooltipCloseBtn = document.getElementById('tooltip-close');
const tooltipFocusBtn = document.getElementById('tooltip-focus-btn');
const tooltipEditBtn = document.getElementById('tooltip-edit-btn');
const tooltipDeleteBtn = document.getElementById('tooltip-delete-btn');

// Modals
const modalAdd = document.getElementById('modal-add');
const modalAddForm = document.getElementById('modal-add-form');
const inputTitle = document.getElementById('input-title');
const inputDesc = document.getElementById('input-desc');
const cancelAddBtn = document.getElementById('cancel-add-btn');

const modalEdit = document.getElementById('modal-edit');
const modalEditForm = document.getElementById('modal-edit-form');
const editIdInput = document.getElementById('edit-marker-id');
const editTitleInput = document.getElementById('edit-title');
const editDescInput = document.getElementById('edit-desc');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Options controls
const textureToggle = document.getElementById('texture-toggle');
const textureScaleSlider = document.getElementById('texture-scale-slider');
const texScaleValSpan = document.getElementById('tex-scale-val');
const wireframeToggle = document.getElementById('wireframe-toggle');
const ambientLightSlider = document.getElementById('ambient-light-slider');
const ambientValSpan = document.getElementById('ambient-val');
const dirLightSlider = document.getElementById('dir-light-slider');
const dirValSpan = document.getElementById('dir-val');
const themeChips = document.querySelectorAll('.theme-chip');

// Loading overlay
const loadingOverlay = document.getElementById('loading-overlay');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const progressBytes = document.getElementById('progress-bytes');

// --- 1. Three.js Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f17);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.copy(AppState.initialCameraPosition);
camera.up.set(0, 1, 0); // Y is UP

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.screenSpacePanning = true;

// Lighting Rig
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.7);
fillLight.position.set(-5, -3, -5);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.5);
scene.add(hemiLight);

// --- PBR Bone Material Setup ---
const textureLoader = new THREE.TextureLoader();

const boneAlbedoMap = textureLoader.load('bone-texture/bone_albedo.png');
boneAlbedoMap.colorSpace = THREE.SRGBColorSpace;
boneAlbedoMap.wrapS = THREE.RepeatWrapping;
boneAlbedoMap.wrapT = THREE.RepeatWrapping;

const boneNormalMap = textureLoader.load('bone-texture/bone_normal-ogl.png');
boneNormalMap.wrapS = THREE.RepeatWrapping;
boneNormalMap.wrapT = THREE.RepeatWrapping;

const boneRoughnessMap = textureLoader.load('bone-texture/bone_roughness.png');
boneRoughnessMap.wrapS = THREE.RepeatWrapping;
boneRoughnessMap.wrapT = THREE.RepeatWrapping;

const boneAoMap = textureLoader.load('bone-texture/bone_ao.png');
boneAoMap.wrapS = THREE.RepeatWrapping;
boneAoMap.wrapT = THREE.RepeatWrapping;

const boneMaterial = new THREE.MeshStandardMaterial({
    map: boneAlbedoMap,
    normalMap: boneNormalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: boneRoughnessMap,
    roughness: 0.75,
    metalness: 0.03,
    aoMap: boneAoMap,
    aoMapIntensity: 0.95,
    wireframe: false
});

const defaultMaterial = new THREE.MeshStandardMaterial({
    color: 0xedf2f7,
    roughness: 0.6,
    metalness: 0.1,
    wireframe: false
});

function updateTextureScale(scaleFactor) {
    AppState.textureScale = scaleFactor;
    [boneAlbedoMap, boneNormalMap, boneRoughnessMap, boneAoMap].forEach(tex => {
        if (tex) {
            tex.repeat.set(scaleFactor, scaleFactor);
            tex.needsUpdate = true;
        }
    });
}

// Generate Box UVs across all 3 projection planes
function generateBoxUVs(geometry, baseScale = 0.02) {
    const pos = geometry.attributes.position;
    const norm = geometry.attributes.normal;
    const count = pos.count;
    const uvs = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        let nx = 0, ny = 1, nz = 0;
        if (norm) {
            nx = Math.abs(norm.getX(i));
            ny = Math.abs(norm.getY(i));
            nz = Math.abs(norm.getZ(i));
        }

        let u, v;
        if (ny >= nx && ny >= nz) {
            // Dominant normal is Y (top/bottom)
            u = x * baseScale;
            v = z * baseScale;
        } else if (nx >= ny && nx >= nz) {
            // Dominant normal is X (sides)
            u = z * baseScale;
            v = y * baseScale;
        } else {
            // Dominant normal is Z (front/back)
            u = x * baseScale;
            v = y * baseScale;
        }

        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
    }

    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2)); // For aoMap
    geometry.attributes.uv.needsUpdate = true;
    geometry.attributes.uv2.needsUpdate = true;
}

// Group to hold 3D markers
const markersGroup = new THREE.Group();
scene.add(markersGroup);

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- 2. Marker Texture Generation ---
function createBadgeCanvas(number, isActive = false, isHovered = false) {
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
    ctx.shadowColor = isActive ? 'rgba(56, 189, 248, 0.9)' : (isHovered ? 'rgba(14, 165, 233, 0.8)' : 'rgba(2, 132, 199, 0.5)');
    ctx.shadowBlur = isActive ? 36 : (isHovered ? 28 : 18);

    // Circle background gradient
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
    ctx.strokeStyle = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();

    // Inner subtle ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 14, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.stroke();

    // Number text
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

function createMarkerVisual(markerData) {
    const group = new THREE.Group();
    group.userData = { markerId: markerData.id, number: markerData.number };

    const scale = (AppState.modelBoundingSphere ? AppState.modelBoundingSphere.radius : 1.0) * 0.12;

    // 1. Surface Anchor Dot
    const dotGeo = new THREE.SphereGeometry(scale * 0.1, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const dotMesh = new THREE.Mesh(dotGeo, dotMat);
    dotMesh.position.set(0, 0, 0);
    group.add(dotMesh);

    // 2. Stem line connecting anchor to elevated badge
    const stemHeight = scale * 0.45;
    const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, linewidth: 2 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, stemHeight, 0)
    ]);
    const stemLine = new THREE.Line(lineGeo, lineMat);
    group.add(stemLine);

    // 3. Billboard Sprite Badge
    const canvas = createBadgeCanvas(markerData.number, markerData.id === AppState.selectedMarkerId);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(0, stemHeight, 0);
    sprite.renderOrder = 999;
    sprite.userData = { isMarkerSprite: true, markerId: markerData.id };
    group.add(sprite);

    // Position whole group at marker coordinates and orient along normal
    group.position.set(markerData.position.x, markerData.position.y, markerData.position.z);
    
    if (markerData.normal) {
        const normalVec = new THREE.Vector3(markerData.normal.x, markerData.normal.y, markerData.normal.z).normalize();
        const upVec = new THREE.Vector3(0, 1, 0);
        group.quaternion.setFromUnitVectors(upVec, normalVec);
    }

    return { group, sprite, texture };
}

// Rebuild all 3D markers from AppState.markers
function syncSceneMarkers() {
    // Clear existing
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

    // Build new
    AppState.markers.forEach((markerData, index) => {
        markerData.number = index + 1; // ensure 1-based sequential numbering
        const { group } = createMarkerVisual(markerData);
        markerData.threeGroup = group;
        markersGroup.add(group);
    });

    updateSidebarList();
    updateMarkerCounts();
    saveMarkersToLocalStorage();
}

function updateMarkerBadgeTexture(markerId, isActive = false, isHovered = false) {
    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker || !marker.threeGroup) return;

    const sprite = marker.threeGroup.children.find(c => c.isSprite);
    if (!sprite) return;

    const canvas = createBadgeCanvas(marker.number, isActive, isHovered);
    if (sprite.material.map) sprite.material.map.dispose();
    sprite.material.map = new THREE.CanvasTexture(canvas);
    sprite.material.map.colorSpace = THREE.SRGBColorSpace;
    sprite.material.map.needsUpdate = true;
}

// Compute anatomical centroid of the foot body (ignoring upper protruding shin)
function getFootCentroid(model) {
    let sumX = 0, sumY = 0, sumZ = 0;
    let samples = 0;
    model.traverse((child) => {
        if (child.isMesh && child.geometry) {
            const pos = child.geometry.attributes.position;
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

// --- 3. Model Loading & Auto-framing ---
function loadModel() {
    const loader = new GLTFLoader();
    const modelUrl = 'Full_Foot.glb';
    const estimatedTotalBytes = 40605948; // ~38.7 MB

    loader.load(
        modelUrl,
        (gltf) => {
            AppState.footModel = gltf.scene;

            // Compute foot centroid based on vertex density (places pivot inside the foot body)
            const footCenter = getFootCentroid(AppState.footModel);
            AppState.footModel.position.sub(footCenter);
            AppState.footModel.updateMatrixWorld(true);

            // Compute Bounding Sphere after centering for optimal camera framing
            const box = new THREE.Box3().setFromObject(AppState.footModel);
            const sphere = box.getBoundingSphere(new THREE.Sphere());
            AppState.modelBoundingSphere = sphere;

            // Generate Box UVs and apply bone material
            AppState.footModel.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Generate Tri-Planar Box UVs
                    generateBoxUVs(child.geometry, 0.02);
                    child.material = AppState.useTexture ? boneMaterial : defaultMaterial;
                    child.material.wireframe = AppState.wireframeEnabled;
                }
            });

            scene.add(AppState.footModel);

            // Optimal Camera Framing based on centered foot
            const radius = sphere.radius;
            const dist = radius * 2.0;
            // Upright foot: Y is UP, Z is length, X is width
            AppState.initialCameraPosition.set(dist * 0.65, dist * 0.45, dist * 0.85);
            AppState.initialCameraTarget.set(0, 0, 0);

            camera.position.copy(AppState.initialCameraPosition);
            camera.up.set(0, 1, 0);
            controls.target.copy(AppState.initialCameraTarget);
            controls.maxDistance = radius * 6;
            controls.minDistance = radius * 0.2;
            controls.update();

            // Load saved markers
            loadMarkersFromLocalStorage();
            syncSceneMarkers();

            // Fade out loading screen
            setTimeout(() => {
                loadingOverlay.classList.add('fade-out');
            }, 300);
        },
        (xhr) => {
            const total = xhr.total > 0 ? xhr.total : estimatedTotalBytes;
            const percent = Math.min(Math.round((xhr.loaded / total) * 100), 100);
            progressBar.style.width = `${percent}%`;
            progressPercent.textContent = `${percent}%`;
            const loadedMb = (xhr.loaded / (1024 * 1024)).toFixed(1);
            const totalMb = (total / (1024 * 1024)).toFixed(1);
            progressBytes.textContent = `${loadedMb} MB / ${totalMb} MB`;
        },
        (error) => {
            console.error('Fehler beim Laden des Modells:', error);
            showToast('Fehler beim Laden von Full_Foot.glb', 'error');
            progressBytes.textContent = 'Fehler beim Laden!';
        }
    );
}

// --- 4. Camera Transitions (Smooth Fly-to) ---
function flyToPosition(targetPosition, normalOffset = null, duration = 800) {
    const startCamPos = camera.position.clone();
    const startControlsTarget = controls.target.clone();

    const endTarget = targetPosition.clone();
    const radius = AppState.modelBoundingSphere ? AppState.modelBoundingSphere.radius : 1.0;
    const viewDistance = radius * 0.65;

    let endCamPos;
    if (normalOffset) {
        endCamPos = targetPosition.clone().add(normalOffset.clone().normalize().multiplyScalar(viewDistance));
    } else {
        const offsetDir = camera.position.clone().sub(controls.target).normalize();
        endCamPos = targetPosition.clone().add(offsetDir.multiplyScalar(viewDistance));
    }

    const startTime = performance.now();

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    AppState.cameraAnimation = {
        update: (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1.0);
            const t = easeInOutCubic(progress);

            camera.position.lerpVectors(startCamPos, endCamPos, t);
            controls.target.lerpVectors(startControlsTarget, endTarget, t);
            controls.update();

            if (progress >= 1.0) {
                AppState.cameraAnimation = null;
            }
        }
    };
}

function resetCameraView() {
    const startCamPos = camera.position.clone();
    const startControlsTarget = controls.target.clone();
    const endCamPos = AppState.initialCameraPosition.clone();
    const endTarget = AppState.initialCameraTarget.clone();
    const startTime = performance.now();

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    AppState.cameraAnimation = {
        update: (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / 700, 1.0);
            const t = easeInOutCubic(progress);

            camera.position.lerpVectors(startCamPos, endCamPos, t);
            controls.target.lerpVectors(startControlsTarget, endTarget, t);
            controls.update();

            if (progress >= 1.0) {
                AppState.cameraAnimation = null;
            }
        }
    };
}

// --- 5. Selection & Tooltip Positioning ---
function selectMarker(markerId, smoothFly = true) {
    if (AppState.selectedMarkerId) {
        updateMarkerBadgeTexture(AppState.selectedMarkerId, false);
    }

    AppState.selectedMarkerId = markerId;

    if (!markerId) {
        floatingTooltip.classList.remove('visible');
        floatingTooltip.style.display = 'none';
        updateSidebarCardHighlight(null);
        return;
    }

    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker) {
        floatingTooltip.classList.remove('visible');
        floatingTooltip.style.display = 'none';
        updateSidebarCardHighlight(null);
        return;
    }

    updateMarkerBadgeTexture(markerId, true);
    updateSidebarCardHighlight(markerId);

    // Update Floating Tooltip Content
    tooltipBadge.textContent = String(marker.number);
    tooltipTitle.textContent = marker.title;
    tooltipDesc.textContent = marker.description || 'Keine Notiz vorhanden.';
    floatingTooltip.style.display = 'block';
    floatingTooltip.classList.add('visible');

    // Fly camera if requested
    if (smoothFly && marker.threeGroup) {
        const targetPos = marker.threeGroup.position.clone();
        const normal = marker.normal ? new THREE.Vector3(marker.normal.x, marker.normal.y, marker.normal.z) : null;
        flyToPosition(targetPos, normal, 800);
    }
}

function updateFloatingTooltipPosition() {
    if (!AppState.selectedMarkerId || !floatingTooltip.classList.contains('visible')) {
        floatingTooltip.style.display = 'none';
        return;
    }

    const marker = AppState.markers.find(m => m.id === AppState.selectedMarkerId);
    if (!marker || !marker.threeGroup) {
        floatingTooltip.classList.remove('visible');
        floatingTooltip.style.display = 'none';
        return;
    }

    // Get position of the badge
    const badgePos = new THREE.Vector3();
    const sprite = marker.threeGroup.children.find(c => c.isSprite);
    if (sprite) {
        sprite.getWorldPosition(badgePos);
    } else {
        marker.threeGroup.getWorldPosition(badgePos);
    }

    // Project to screen coordinates
    const vector = badgePos.clone().project(camera);

    // Check if behind camera
    if (vector.z > 1) {
        floatingTooltip.style.display = 'none';
        return;
    }

    floatingTooltip.style.display = 'block';
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    floatingTooltip.style.left = `${Math.round(x)}px`;
    floatingTooltip.style.top = `${Math.round(y)}px`;
}

// --- 6. Interaction & Raycasting ---
let pointerDownPos = { x: 0, y: 0 };

window.addEventListener('pointerdown', (e) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
    AppState.isDragging = false;
});

window.addEventListener('pointermove', (e) => {
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist > 5) {
        AppState.isDragging = true;
    }

    // Hover effect on markers in Navigate mode
    if (AppState.mode === 'navigate') {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const hitSprites = raycaster.intersectObjects(
            markersGroup.children.flatMap(g => g.children.filter(c => c.isSprite))
        );

        if (hitSprites.length > 0) {
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'default';
        }
    }
});

window.addEventListener('pointerup', (e) => {
    // Ignore drags
    if (AppState.isDragging) return;

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

    // 1. Check if an existing marker sprite was clicked
    const spriteHits = raycaster.intersectObjects(
        markersGroup.children.flatMap(g => g.children.filter(c => c.isSprite))
    );

    if (spriteHits.length > 0) {
        const clickedSprite = spriteHits[0].object;
        const markerId = clickedSprite.userData.markerId;
        selectMarker(markerId, true);
        return;
    }

    // 2. Check if foot model was clicked
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

// Double click in Navigate mode: Center rotation pivot smoothly on clicked point
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

// --- 7. Modals & Marker Creation/Editing ---
function openAddModal() {
    inputTitle.value = '';
    inputDesc.value = '';
    modalAdd.showModal();
    inputTitle.focus();
}

modalAddForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = inputTitle.value.trim();
    const description = inputDesc.value.trim();

    if (!title || !AppState.pendingHit) return;

    // Slight offset along face normal to avoid clipping
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
    syncSceneMarkers();
    selectMarker(newMarker.id, true);

    modalAdd.close();
    AppState.pendingHit = null;

    // Return to navigate mode
    setMode('navigate');
    showToast(`Punkt "${title}" erfolgreich hinzugefügt!`, 'success');
});

cancelAddBtn.addEventListener('click', () => {
    modalAdd.close();
    AppState.pendingHit = null;
});

modalAdd.addEventListener('cancel', () => {
    AppState.pendingHit = null;
});

function openEditModal(markerId) {
    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker) return;

    editIdInput.value = marker.id;
    editTitleInput.value = marker.title;
    editDescInput.value = marker.description || '';
    modalEdit.showModal();
    editTitleInput.focus();
}

modalEditForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = editIdInput.value;
    const title = editTitleInput.value.trim();
    const description = editDescInput.value.trim();

    const marker = AppState.markers.find(m => m.id === id);
    if (marker) {
        marker.title = title;
        marker.description = description;
        syncSceneMarkers();
        selectMarker(id, false);
        modalEdit.close();
        showToast('Markierung aktualisiert.', 'success');
    }
});

cancelEditBtn.addEventListener('click', () => {
    modalEdit.close();
});

function deleteMarker(markerId) {
    const marker = AppState.markers.find(m => m.id === markerId);
    if (!marker) return;

    if (confirm(`Möchtest du den Punkt #${marker.number} "${marker.title}" wirklich löschen?`)) {
        AppState.markers = AppState.markers.filter(m => m.id !== markerId);
        if (AppState.selectedMarkerId === markerId) {
            selectMarker(null);
        }
        syncSceneMarkers();
        showToast('Markierung gelöscht.', 'info');
    }
}

// --- 8. Sidebar UI & Filtering ---
function updateSidebarList() {
    const query = AppState.searchQuery.toLowerCase().trim();
    const filtered = AppState.markers.filter(m => {
        return m.title.toLowerCase().includes(query) || (m.description && m.description.toLowerCase().includes(query));
    });

    markersList.innerHTML = '';

    if (filtered.length === 0) {
        if (AppState.markers.length === 0) {
            markersList.innerHTML = `
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
            markersList.innerHTML = `
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
            selectMarker(marker.id, true);
        });

        // Focus Button
        card.querySelector('.focus-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            selectMarker(marker.id, true);
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

        markersList.appendChild(card);
    });
}

function updateSidebarCardHighlight(selectedId) {
    document.querySelectorAll('.marker-card').forEach(card => {
        if (card.dataset.markerId === selectedId) {
            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            card.classList.remove('active');
        }
    });
}

function updateMarkerCounts() {
    const count = AppState.markers.length;
    markerCountBadge.textContent = count;
    sidebarCountPill.textContent = `${count} ${count === 1 ? 'Punkt' : 'Punkte'}`;
}

searchInput.addEventListener('input', (e) => {
    AppState.searchQuery = e.target.value;
    updateSidebarList();
});

// --- 9. Floating Tooltip Button Bindings ---
tooltipCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    selectMarker(null);
});

tooltipFocusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (AppState.selectedMarkerId) selectMarker(AppState.selectedMarkerId, true);
});

tooltipEditBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (AppState.selectedMarkerId) openEditModal(AppState.selectedMarkerId);
});

tooltipDeleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (AppState.selectedMarkerId) deleteMarker(AppState.selectedMarkerId);
});

// Escape key closes open tooltip or deselects
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (AppState.selectedMarkerId) {
            selectMarker(null);
        }
    }
});

// --- 10. Mode Switching ---
function setMode(newMode) {
    AppState.mode = newMode;

    if (newMode === 'navigate') {
        modeNavBtn.classList.add('active');
        modeAddBtn.classList.remove('active');
        modeBanner.classList.add('hidden');
        canvasContainer.classList.remove('crosshair-cursor');
    } else {
        modeAddBtn.classList.add('active');
        modeNavBtn.classList.remove('active');
        modeBanner.classList.remove('hidden');
        canvasContainer.classList.add('crosshair-cursor');
        selectMarker(null); // deselect existing when in add mode
    }
}

modeNavBtn.addEventListener('click', () => setMode('navigate'));
modeAddBtn.addEventListener('click', () => setMode('add'));

// --- 11. Display & Render Options ---
textureToggle.addEventListener('change', (e) => {
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

textureScaleSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    texScaleValSpan.textContent = `${val.toFixed(1)}x`;
    updateTextureScale(val);
});

wireframeToggle.addEventListener('change', (e) => {
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

ambientLightSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    ambientLight.intensity = val;
    ambientValSpan.textContent = val.toFixed(1);
});

dirLightSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    dirLight.intensity = val;
    dirValSpan.textContent = val.toFixed(1);
});

themeChips.forEach(chip => {
    chip.addEventListener('click', () => {
        themeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const color = chip.dataset.color;
        scene.background = new THREE.Color(color);
        document.body.style.backgroundColor = color;
    });
});

resetViewBtn.addEventListener('click', () => resetCameraView());

// --- 12. Panel Toggles (Sidebar & Options) ---
toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    toggleSidebarBtn.classList.toggle('active', !sidebar.classList.contains('collapsed'));
});

closeSidebarBtn.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    toggleSidebarBtn.classList.remove('active');
});

toggleOptionsBtn.addEventListener('click', () => {
    optionsDrawer.classList.toggle('hidden');
    toggleOptionsBtn.classList.toggle('active', !optionsDrawer.classList.contains('hidden'));
});

closeOptionsBtn.addEventListener('click', () => {
    optionsDrawer.classList.add('hidden');
    toggleOptionsBtn.classList.remove('active');
});

// --- 13. Persistence & Export / Import ---
function saveMarkersToLocalStorage() {
    try {
        const cleanMarkers = AppState.markers.map(({ id, number, title, description, position, normal, createdAt }) => ({
            id, number, title, description, position, normal, createdAt
        }));
        localStorage.setItem(AppState.storageKey, JSON.stringify(cleanMarkers));
    } catch (err) {
        console.warn('LocalStorage save failed:', err);
    }
}

function loadMarkersFromLocalStorage() {
    try {
        let raw = localStorage.getItem('podotomy_foot_annotations_v2');
        if (raw) {
            AppState.markers = JSON.parse(raw);
            return;
        }

        // Migrate from v1 if present
        raw = localStorage.getItem('podotomy_foot_annotations_v1');
        if (raw) {
            const v1Markers = JSON.parse(raw);
            v1Markers.forEach(m => {
                if (m.position) {
                    if (m.position.x < -35 && m.position.y < -35) {
                        m.position.x += 106.843;
                        m.position.y += 130.002;
                        m.position.z -= 5.246;
                    }
                    // Rotate -90 around X: x' = x, y' = z, z' = -y
                    const ox = m.position.x;
                    const oy = m.position.y;
                    const oz = m.position.z;
                    m.position.x = ox;
                    m.position.y = oz;
                    m.position.z = -oy;

                    if (m.normal) {
                        const nx = m.normal.x || 0;
                        const ny = m.normal.y || 1;
                        const nz = m.normal.z || 0;
                        m.normal.x = nx;
                        m.normal.y = nz;
                        m.normal.z = -ny;
                    }
                }
            });
            AppState.markers = v1Markers;
            saveMarkersToLocalStorage();
        }
    } catch (err) {
        console.warn('LocalStorage load failed:', err);
        AppState.markers = [];
    }
}

exportBtn.addEventListener('click', () => {
    if (AppState.markers.length === 0) {
        showToast('Keine Markierungen zum Exportieren vorhanden.', 'warning');
        return;
    }

    const cleanData = {
        model: 'Full_Foot.glb',
        exportedAt: new Date().toISOString(),
        markersCount: AppState.markers.length,
        annotations: AppState.markers.map(({ id, number, title, description, position, normal, createdAt }) => ({
            id, number, title, description, position, normal, createdAt
        }))
    };

    const blob = new Blob([JSON.stringify(cleanData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fuss_anatomie_markierungen_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Markierungen als JSON exportiert!', 'success');
});

importBtn.addEventListener('click', () => {
    importFileInput.value = '';
    importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            const importedMarkers = Array.isArray(data) ? data : data.annotations;

            if (!Array.isArray(importedMarkers)) {
                throw new Error('Ungültiges Format: Keine Markierungsliste gefunden.');
            }

            // Validate format
            const validMarkers = importedMarkers.filter(m => m && m.title && m.position && typeof m.position.x === 'number');

            if (validMarkers.length === 0) {
                showToast('Keine gültigen Markierungen in der Datei gefunden.', 'error');
                return;
            }

            AppState.markers = validMarkers;
            syncSceneMarkers();
            selectMarker(null);
            showToast(`${validMarkers.length} Markierungen erfolgreich importiert!`, 'success');
        } catch (err) {
            console.error('Import-Fehler:', err);
            showToast('Fehler beim Importieren: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
});

clearAllBtn.addEventListener('click', () => {
    if (AppState.markers.length === 0) return;
    if (confirm('Möchtest du wirklich ALLE gesetzten Punkte unwiderruflich löschen?')) {
        AppState.markers = [];
        selectMarker(null);
        syncSceneMarkers();
        showToast('Alle Markierungen wurden gelöscht.', 'info');
    }
});

// --- 14. Toast Notifications ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- 15. Animation Loop & Resizing ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function animate(time) {
    requestAnimationFrame(animate);

    // Camera fly animation tween
    if (AppState.cameraAnimation) {
        AppState.cameraAnimation.update(time);
    } else {
        controls.update();
    }

    // Active marker gentle pulsing
    if (AppState.selectedMarkerId) {
        const marker = AppState.markers.find(m => m.id === AppState.selectedMarkerId);
        if (marker && marker.threeGroup) {
            const sprite = marker.threeGroup.children.find(c => c.isSprite);
            if (sprite) {
                const baseScale = (AppState.modelBoundingSphere ? AppState.modelBoundingSphere.radius : 1.0) * 0.12;
                const pulse = 1.0 + 0.08 * Math.sin(time * 0.006);
                sprite.scale.set(baseScale * pulse, baseScale * pulse, 1);
            }
        }
    }

    // Update floating tooltip position in 2D screen space
    updateFloatingTooltipPosition();

    renderer.render(scene, camera);
}

// Start Application
loadModel();
animate(0);
