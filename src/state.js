import * as THREE from 'three';

/**
 * Global reactive application state
 */
export const AppState = {
    mode: 'navigate', // 'navigate' | 'add'
    markers: [],
    selectedMarkerId: null,
    hoveredMarkerId: null,
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
    storageKey: 'podotomy_foot_annotations_v2',
    interactiveMarkerObjects: []
};

/**
 * Returns the currently selected marker object if any
 * @returns {object|null}
 */
export function getSelectedMarker() {
    if (!AppState.selectedMarkerId) return null;
    return AppState.markers.find(m => m.id === AppState.selectedMarkerId) || null;
}

/**
 * Returns a marker by its unique ID
 * @param {string} id
 * @returns {object|null}
 */
export function getMarkerById(id) {
    return AppState.markers.find(m => m.id === id) || null;
}
