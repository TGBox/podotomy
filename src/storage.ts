import { AppState } from './state.js';
import type { AnnotationMarker, ExportData } from './types.js';

/**
 * Persists current markers to browser LocalStorage
 */
export function saveMarkersToLocalStorage(): void {
    try {
        const cleanMarkers = AppState.markers.map(({ id, number, title, description, position, normal, createdAt, view }) => ({
            id, number, title, description, position, normal, createdAt, view: view || 'bone'
        }));
        localStorage.setItem(AppState.storageKey, JSON.stringify(cleanMarkers));
    } catch (err) {
        console.warn('LocalStorage save failed:', err);
    }
}

/**
 * Loads persisted markers from LocalStorage
 */
export function loadMarkersFromLocalStorage(): void {
    try {
        const raw = localStorage.getItem(AppState.storageKey);
        if (raw) {
            const parsed: AnnotationMarker[] = JSON.parse(raw);
            parsed.forEach(m => {
                if (!m.view) m.view = 'bone';
            });
            AppState.markers = parsed;
        }
    } catch (err) {
        console.warn('LocalStorage load failed:', err);
        AppState.markers = [];
    }
}

/**
 * Generates and downloads formatted JSON file containing all annotations
 */
export function exportMarkersJSON(): boolean {
    if (AppState.markers.length === 0) {
        return false;
    }

    const cleanData: ExportData = {
        model: 'bones_foot.glb & skin_foot.glb',
        exportedAt: new Date().toISOString(),
        markersCount: AppState.markers.length,
        annotations: AppState.markers.map(({ id, number, title, description, position, normal, createdAt, view }) => ({
            id, number, title, description, position, normal, createdAt, view: view || 'bone'
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
 * @param file 
 * @param onSuccess 
 * @param onError 
 */
export function importMarkersJSON(
    file: File,
    onSuccess: (markers: AnnotationMarker[]) => void,
    onError: (err: Error) => void
): void {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
            const rawContent = event.target?.result as string;
            const data = JSON.parse(rawContent);
            const importedMarkers: AnnotationMarker[] = Array.isArray(data) ? data : data.annotations;

            if (!Array.isArray(importedMarkers)) {
                throw new Error('Ungültiges Format: Keine Markierungsliste gefunden.');
            }

            // Validate format and ensure view is typed properly
            const validMarkers = importedMarkers
                .filter(m => m && m.title && m.position && typeof m.position.x === 'number')
                .map(m => ({
                    ...m,
                    view: (m.view === 'skin' ? 'skin' : 'bone') as 'bone' | 'skin'
                }));

            if (validMarkers.length === 0) {
                throw new Error('Keine gültigen Markierungen in der Datei gefunden.');
            }

            onSuccess(validMarkers);
        } catch (err) {
            console.error('Import error:', err);
            onError(err instanceof Error ? err : new Error(String(err)));
        }
    };
    reader.readAsText(file);
}
