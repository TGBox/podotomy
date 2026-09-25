import type * as THREE from 'three';

export interface Vector3Like {
    x: number;
    y: number;
    z: number;
}

export interface AnnotationMarker {
    id: string;
    number: number;
    title: string;
    description: string;
    position: Vector3Like;
    normal?: Vector3Like;
    createdAt: string;
    threeGroup?: THREE.Group;
    sprite?: THREE.Sprite;
    stemLine?: THREE.Line;
    dotMesh?: THREE.Mesh;
    hitMesh?: THREE.Mesh;
    badgeTexture?: THREE.CanvasTexture;
    dotTexture?: THREE.CanvasTexture;
    isOccluded?: boolean;
}

export type InteractionMode = 'navigate' | 'add';

export interface CameraAnimation {
    update: (now: number) => void;
}

export interface PendingHit {
    point: THREE.Vector3;
    normal: THREE.Vector3;
}

export interface AppStateInterface {
    mode: InteractionMode;
    markers: AnnotationMarker[];
    selectedMarkerId: string | null;
    hoveredMarkerId: string | null;
    footModel: THREE.Group | null;
    modelBoundingSphere: THREE.Sphere | null;
    initialCameraPosition: THREE.Vector3;
    initialCameraTarget: THREE.Vector3;
    isDragging: boolean;
    cameraAnimation: CameraAnimation | null;
    pendingHit: PendingHit | null;
    wireframeEnabled: boolean;
    useTexture: boolean;
    textureScale: number;
    modelScaleFactor: number;
    searchQuery: string;
    storageKey: string;
    interactiveMarkerObjects: THREE.Object3D[];
}

export interface ActionHandlers {
    selectMarker?: (id: string | null, smoothFly?: boolean) => void;
    syncSceneMarkers?: () => void;
    resetCameraView?: () => void;
}

export interface ExportData {
    model: string;
    exportedAt: string;
    markersCount: number;
    annotations: Array<{
        id: string;
        number: number;
        title: string;
        description: string;
        position: Vector3Like;
        normal?: Vector3Like;
        createdAt: string;
    }>;
}
