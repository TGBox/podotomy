import { AppState } from './state.js';

/**
 * Persists current markers to browser LocalStorage
 */
export function saveMarkersToLocalStorage() {
    try {
        const cleanMarkers = AppState.markers.map(({ id, number, title, description, position, normal, createdAt }) => ({
            id, number, title, description, position, normal, createdAt
        }));
        localStorage.setItem(AppState.storageKey, JSON.stringify(cleanMarkers));
    } catch (err) {
        console.warn('LocalStorage save failed:', err);
    }
}

/**
 * Loads persisted markers from LocalStorage (with legacy v1 schema migration)
 */
export function loadMarkersFromLocalStorage() {
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

/**
 * Generates and downloads formatted JSON file containing all annotations
 */
export function exportMarkersJSON() {
    if (AppState.markers.length === 0) {
        return false;
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
    return true;
}

/**
 * Parses and validates an uploaded JSON annotation file
 * @param {File} file 
 * @param {Function} onSuccess 
 * @param {Function} onError 
 */
export function importMarkersJSON(file, onSuccess, onError) {
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
                throw new Error('Keine gültigen Markierungen in der Datei gefunden.');
            }

            onSuccess(validMarkers);
        } catch (err) {
            console.error('Import error:', err);
            onError(err);
        }
    };
    reader.readAsText(file);
}
