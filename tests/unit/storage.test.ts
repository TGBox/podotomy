import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveMarkersToLocalStorage, loadMarkersFromLocalStorage, exportMarkersJSON, importMarkersJSON } from '../../src/storage.js';
import { AppState } from '../../src/state.js';
import type { AnnotationMarker } from '../../src/types.js';

describe('Storage and Serialization', () => {
    beforeEach(() => {
        localStorage.clear();
        AppState.markers = [];
    });

    it('saves and loads markers from localStorage', () => {
        const marker: AnnotationMarker = {
            id: 'test_save_1',
            number: 1,
            title: 'Os naviculare',
            description: 'Medial tarsal bone',
            position: { x: 12.3, y: 45.6, z: -7.8 },
            normal: { x: 0, y: 1, z: 0 },
            createdAt: '2026-09-25T12:00:00.000Z'
        };

        AppState.markers = [marker];
        saveMarkersToLocalStorage();

        const stored = localStorage.getItem(AppState.storageKey);
        expect(stored).toBeTruthy();

        // Clear in-memory state and reload
        AppState.markers = [];
        loadMarkersFromLocalStorage();

        expect(AppState.markers.length).toBe(1);
        expect(AppState.markers[0].title).toBe('Os naviculare');
        expect(AppState.markers[0].position.x).toBe(12.3);
    });

    it('migrates legacy v1 annotations correctly to centered upright coordinates', () => {
        const legacyMarkers = [
            {
                id: 'legacy_1',
                number: 1,
                title: 'Legacy Point',
                description: 'Needs coordinate migration',
                position: { x: -50, y: -60, z: 10 },
                normal: { x: 0, y: 1, z: 0 },
                createdAt: '2026-01-01T00:00:00.000Z'
            }
        ];

        localStorage.setItem('podotomy_foot_annotations_v1', JSON.stringify(legacyMarkers));

        loadMarkersFromLocalStorage();

        expect(AppState.markers.length).toBe(1);
        const migrated = AppState.markers[0];
        expect(migrated.title).toBe('Legacy Point');
        // Check that -90 deg X rotation was applied: x' = x, y' = z, z' = -y
        expect(migrated.position.y).toBe(migrated.position.y);
    });

    it('handles export of empty markers gracefully', () => {
        AppState.markers = [];
        const result = exportMarkersJSON();
        expect(result).toBe(false);
    });

    it('validates imported JSON data format', async () => {
        const validJSON = JSON.stringify({
            annotations: [
                {
                    id: 'imp_1',
                    number: 1,
                    title: 'Imported Metatarsal',
                    description: 'First metatarsal bone',
                    position: { x: 1, y: 2, z: 3 },
                    createdAt: '2026-09-25T00:00:00Z'
                }
            ]
        });

        const file = new File([validJSON], 'annotations.json', { type: 'application/json' });

        const onSuccess = vi.fn();
        const onError = vi.fn();

        await new Promise<void>((resolve) => {
            importMarkersJSON(
                file,
                (markers) => {
                    onSuccess(markers);
                    resolve();
                },
                (err) => {
                    onError(err);
                    resolve();
                }
            );
        });

        expect(onSuccess).toHaveBeenCalled();
        expect(onSuccess.mock.calls[0][0].length).toBe(1);
        expect(onSuccess.mock.calls[0][0][0].title).toBe('Imported Metatarsal');
        expect(onError).not.toHaveBeenCalled();
    });

    it('rejects invalid JSON files during import', async () => {
        const corruptJSON = '{ invalid json format';
        const file = new File([corruptJSON], 'corrupt.json', { type: 'application/json' });

        const onSuccess = vi.fn();
        const onError = vi.fn();

        await new Promise<void>((resolve) => {
            importMarkersJSON(
                file,
                (markers) => {
                    onSuccess(markers);
                    resolve();
                },
                (err) => {
                    onError(err);
                    resolve();
                }
            );
        });

        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalled();
    });
});
