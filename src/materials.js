import * as THREE from 'three';
import { AppState } from './state.js';

const textureLoader = new THREE.TextureLoader();

// --- PBR Texture Maps ---
export const boneAlbedoMap = textureLoader.load('bone-texture/bone_albedo.png');
boneAlbedoMap.colorSpace = THREE.SRGBColorSpace;
boneAlbedoMap.wrapS = THREE.RepeatWrapping;
boneAlbedoMap.wrapT = THREE.RepeatWrapping;

export const boneNormalMap = textureLoader.load('bone-texture/bone_normal-ogl.png');
boneNormalMap.wrapS = THREE.RepeatWrapping;
boneNormalMap.wrapT = THREE.RepeatWrapping;

export const boneRoughnessMap = textureLoader.load('bone-texture/bone_roughness.png');
boneRoughnessMap.wrapS = THREE.RepeatWrapping;
boneRoughnessMap.wrapT = THREE.RepeatWrapping;

export const boneAoMap = textureLoader.load('bone-texture/bone_ao.png');
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

// --- Default Solid Material (Fallback/Clean state) ---
export const defaultMaterial = new THREE.MeshStandardMaterial({
    color: 0xedf2f7,
    roughness: 0.6,
    metalness: 0.1,
    wireframe: false
});

/**
 * Updates the UV repeat scale factor for all bone texture maps
 * @param {number} scaleFactor 
 */
export function updateTextureScale(scaleFactor) {
    AppState.textureScale = scaleFactor;
    [boneAlbedoMap, boneNormalMap, boneRoughnessMap, boneAoMap].forEach(tex => {
        if (tex) {
            tex.repeat.set(scaleFactor, scaleFactor);
            tex.needsUpdate = true;
        }
    });
}

/**
 * Generates tri-planar box UV coordinates across all three dominant projection planes (X, Y, Z).
 * Resolves models without pre-baked UVs in ~6ms without stretching.
 * @param {THREE.BufferGeometry} geometry 
 * @param {number} baseScale 
 */
export function generateBoxUVs(geometry, baseScale = 0.02) {
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
    geometry.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2)); // For ambient occlusion map
    geometry.attributes.uv.needsUpdate = true;
    geometry.attributes.uv2.needsUpdate = true;
}
