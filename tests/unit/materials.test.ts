import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateBoxUVs, updateTextureScale, boneMaterial, defaultMaterial, boneAlbedoMap } from '../../src/materials.js';
import { AppState } from '../../src/state.js';

describe('Materials and Box UV Generation', () => {
    it('generates box UVs and UV2 attributes for BufferGeometry', () => {
        const geometry = new THREE.BoxGeometry(10, 20, 30);
        expect(geometry.attributes.uv).toBeDefined();

        // Strip existing UVs
        geometry.deleteAttribute('uv');
        expect(geometry.attributes.uv).toBeUndefined();

        generateBoxUVs(geometry, 0.05);

        expect(geometry.attributes.uv).toBeDefined();
        expect(geometry.attributes.uv2).toBeDefined();
        expect(geometry.attributes.uv.count).toBe(geometry.attributes.position.count);
        expect(geometry.attributes.uv2.count).toBe(geometry.attributes.position.count);

        // Check values are calculated properly
        const uvArray = geometry.attributes.uv.array as Float32Array;
        expect(uvArray.length).toBe(geometry.attributes.position.count * 2);
        let hasNonZero = false;
        for (let i = 0; i < uvArray.length; i++) {
            if (uvArray[i] !== 0) hasNonZero = true;
        }
        expect(hasNonZero).toBe(true);
    });

    it('updates texture scale factor across maps', () => {
        updateTextureScale(2.5);
        expect(AppState.textureScale).toBe(2.5);
        expect(boneAlbedoMap.repeat.x).toBe(2.5);
        expect(boneAlbedoMap.repeat.y).toBe(2.5);

        // Reset
        updateTextureScale(1.0);
        expect(AppState.textureScale).toBe(1.0);
        expect(boneAlbedoMap.repeat.x).toBe(1.0);
    });

    it('has properly configured PBR bone material and fallback material', () => {
        expect(boneMaterial.roughness).toBe(0.75);
        expect(boneMaterial.metalness).toBe(0.03);
        expect(boneMaterial.wireframe).toBe(false);

        expect(defaultMaterial.roughness).toBe(0.6);
        expect(defaultMaterial.metalness).toBe(0.1);
        expect(defaultMaterial.color.getHex()).toBe(0xedf2f7);
    });
});
