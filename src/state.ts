import * as THREE from 'three';
import type { AppStateInterface, AnnotationMarker } from './types.js';

/**
 * Global reactive application state
 */
export const AppState: AppStateInterface = {
    mode: 'navigate',
    activeView: 'bone',
    markers: [],
    selectedMarkerId: null,
    hoveredMarkerId: null,
    boneModel: null,
    skinModel: null,
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
    skinTextureScale: 1.0,
    modelScaleFactor: 1.0,
    searchQuery: '',
    storageKey: 'podotomy_foot_annotations_v2',
    interactiveMarkerObjects: []
};

/**
 * Returns markers associated with the currently active view ('bone' or 'skin')
 */
export function getActiveMarkers(): AnnotationMarker[] {
    return AppState.markers.filter(m => (m.view || 'bone') === AppState.activeView);
}

/**
 * Returns markers associated with the inactive view
 */
export function getInactiveMarkers(): AnnotationMarker[] {
    return AppState.markers.filter(m => (m.view || 'bone') !== AppState.activeView);
}

/**
 * Returns the currently selected marker object if any
 */
export function getSelectedMarker(): AnnotationMarker | null {
    if (!AppState.selectedMarkerId) return null;
    return AppState.markers.find(m => m.id === AppState.selectedMarkerId) || null;
}

/**
 * Returns a marker by its unique ID
 */
export function getMarkerById(id: string): AnnotationMarker | null {
    return AppState.markers.find(m => m.id === id) || null;
}
