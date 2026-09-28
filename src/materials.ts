import * as THREE from 'three';
import { AppState } from './state.js';

const textureLoader = new THREE.TextureLoader();

const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ? import.meta.env.BASE_URL.replace(/\/$/, '') : '';

// --- PBR Texture Maps ---
export const boneAlbedoMap = textureLoader.load(`${base}/textures/bone/bone_albedo.jpg`);
boneAlbedoMap.colorSpace = THREE.SRGBColorSpace;
boneAlbedoMap.wrapS = THREE.RepeatWrapping;
boneAlbedoMap.wrapT = THREE.RepeatWrapping;

export const boneNormalMap = textureLoader.load(`${base}/textures/bone/bone_normal-ogl.jpg`);
boneNormalMap.wrapS = THREE.RepeatWrapping;
boneNormalMap.wrapT = THREE.RepeatWrapping;

export const boneRoughnessMap = textureLoader.load(`${base}/textures/bone/bone_roughness.jpg`);
boneRoughnessMap.wrapS = THREE.RepeatWrapping;
boneRoughnessMap.wrapT = THREE.RepeatWrapping;

export const boneAoMap = textureLoader.load(`${base}/textures/bone/bone_ao.jpg`);
boneAoMap.wrapS = THREE.RepeatWrapping;
boneAoMap.wrapT = THREE.RepeatWrapping;

// --- Bone PBR Material ---
export const boneMaterial = new THREE.MeshStandardMaterial({
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

// --- Skin PBR Texture Maps ---
export const skinAlbedoMap = textureLoader.load(`${base}/textures/skin/skin_0001_color_2k.jpg`);
skinAlbedoMap.colorSpace = THREE.SRGBColorSpace;
skinAlbedoMap.wrapS = THREE.RepeatWrapping;
skinAlbedoMap.wrapT = THREE.RepeatWrapping;

export const skinNormalMap = textureLoader.load(`${base}/textures/skin/skin_0001_normal_directx_2k.jpg`);
skinNormalMap.wrapS = THREE.RepeatWrapping;
skinNormalMap.wrapT = THREE.RepeatWrapping;

export const skinRoughnessMap = textureLoader.load(`${base}/textures/skin/skin_0001_roughness_2k.jpg`);
skinRoughnessMap.wrapS = THREE.RepeatWrapping;
skinRoughnessMap.wrapT = THREE.RepeatWrapping;

export const skinAoMap = textureLoader.load(`${base}/textures/skin/skin_0001_ao_2k.jpg`);
skinAoMap.wrapS = THREE.RepeatWrapping;
skinAoMap.wrapT = THREE.RepeatWrapping;

// --- Skin PBR Material ---
export const skinMaterial = new THREE.MeshStandardMaterial({
    map: skinAlbedoMap,
    normalMap: skinNormalMap,
    normalScale: new THREE.Vector2(0.85, -0.85), // DirectX normal map: invert Y for OpenGL convention
    roughnessMap: skinRoughnessMap,
    roughness: 0.65,
    metalness: 0.02,
    aoMap: skinAoMap,
    aoMapIntensity: 0.5,
    wireframe: false
});

// --- Default Solid Material (Fallback/Clean state) ---
export const defaultMaterial = new THREE.MeshStandardMaterial({
    color: 0xedf2f7,
    roughness: 0.6,
    metalness: 0.1,
    wireframe: false
});

export const defaultSkinMaterial = new THREE.MeshStandardMaterial({
    color: 0xdec1a6,
    roughness: 0.65,
    metalness: 0.02,
    wireframe: false
});

const boneMaps = [boneAlbedoMap, boneNormalMap, boneRoughnessMap, boneAoMap];
const skinMaps = [skinAlbedoMap, skinNormalMap, skinRoughnessMap, skinAoMap];

function setTextureRepeat(maps: THREE.Texture[], scaleFactor: number): void {
    maps.forEach(tex => {
        if (tex) {
            tex.repeat.set(scaleFactor, scaleFactor);
            tex.needsUpdate = true;
        }
    });
}

/**
 * Updates the UV repeat scale factor for all bone texture maps
 */
export function updateTextureScale(scaleFactor: number): void {
    AppState.textureScale = scaleFactor;
    setTextureRepeat(boneMaps, scaleFactor);
}

/**
 * Updates the UV repeat scale factor for all skin texture maps
 */
export function updateSkinTextureScale(scaleFactor: number): void {
    AppState.skinTextureScale = scaleFactor;
    setTextureRepeat(skinMaps, scaleFactor);
}

/**
 * Generates tri-planar box UV coordinates across all three dominant projection planes (X, Y, Z).
 * @param geometry Target BufferGeometry
 * @param baseScale UV scale factor
 */
export function generateBoxUVs(geometry: THREE.BufferGeometry, baseScale = 0.02): void {
    const pos = geometry.attributes.position;
    const norm = geometry.attributes.normal;
    if (!pos) return;

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

        let u: number, v: number;
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
    geometry.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2)); // For ambient occlusion map
    geometry.attributes.uv.needsUpdate = true;
    geometry.attributes.uv2.needsUpdate = true;
}
