import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AppState } from './state.js';

// --- Scene Initialization ---
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f17);

// --- Camera Setup ---
export const camera = new THREE.PerspectiveCamera(45, (typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1), 0.01, 1000);
camera.position.copy(AppState.initialCameraPosition);
camera.up.set(0, 1, 0); // Y-axis is UP (anatomical tibia height)

// --- WebGL Renderer ---
const container = typeof document !== 'undefined' ? document.getElementById('canvas-container') : null;

function createRenderer(): THREE.WebGLRenderer {
    try {
        return new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
    } catch {
        // Fallback for headless/JSDOM testing environments
        const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : ({} as HTMLCanvasElement);
        return {
            domElement: canvas,
            setSize: () => {},
            setPixelRatio: () => {},
            render: () => {},
            toneMapping: 0,
            toneMappingExposure: 1,
            outputColorSpace: ''
        } as unknown as THREE.WebGLRenderer;
    }
}

export const renderer = createRenderer();

if (typeof window !== 'undefined' && renderer.setSize) {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

if (container) {
    container.appendChild(renderer.domElement);
}

// --- Orbit Controls ---
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.screenSpacePanning = true;

// --- Lighting Rig ---
export const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

export const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

export const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.7);
fillLight.position.set(-5, -3, -5);
scene.add(fillLight);

export const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.5);
scene.add(hemiLight);

// --- 3D Markers Hierarchy Group ---
export const markersGroup = new THREE.Group();
scene.add(markersGroup);

// --- Window Resize Listener ---
if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
}
