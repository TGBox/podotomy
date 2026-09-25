# Podotomy 3D - Interaktiver Fuß-Anatomie Annotator

**Podotomy 3D** ist eine moderne, webbasierte 3D-Anwendung zur interaktiven Erkundung, Beschriftung und Vermessung anatomischer Fußknochenstrukturen. Entwickelt mit **Three.js** und nativer **ES-Modul-Architektur** (Zero-Build-Setup), ermöglicht die Applikation das präzise Setzen von 3D-Markierungen direkt auf der Knochenoberfläche, dynamische Verdeckungserkennung (Occlusion Transparency), PBR-Knochentexturierung sowie den flexiblen Im- und Export von Annotationsdaten.

---

## Inhaltsverzeichnis

- [Funktionsübersicht](#funktionsübersicht)
- [Architektur & Modulübersicht](#architektur--modulübersicht)
- [Lokale Einrichtung & Skripte](#lokale-einrichtung--skripte)
- [Test-Suite (Unit, Integration & E2E)](#test-suite-unit-integration--e2e)
- [3D-Geometrie & Anatomische Konventionen](#3d-geometrie--anatomische-konventionen)
  - [Koordinatensystem & Ausrichtung](#koordinatensystem--ausrichtung)
  - [Dichte-basierte Fußzentrierung](#dichte-basierte-fußzentrierung)
  - [Tri-Planare Box-UVs](#tri-planare-box-uvs)
  - [PBR-Knochenmaterial](#pbr-knochenmaterial)
- [Interaktions- & Annotationssystem](#interaktions---annotationssystem)
  - [Zwei-Stufen-Badges (Idle vs. Hover/Select)](#zwei-stufen-badges-idle-vs-hoverselect)
  - [Echtzeit-Okklusionstransparenz](#echtzeit-okklusionstransparenz)
  - [Fokussierungs- & Kameraflug-Animation](#fokussierungs---kameraflug-animation)
- [Datenpersistenz & JSON-Schnittstelle](#datenpersistenz--json-schnittstelle)

---

## Funktionsübersicht

- **Echtes 3D-Knochenmodell:** Laden des hochauflösenden anatomischen 38,7 MB GLTF-Modells (`Full_Foot.glb`).
- **PBR-Materialien & Texturskalierung:** Realistisches Rendering mit Albedo-, Normal-, Roughness- und Ambient-Occlusion-Maps sowie Tri-Planarer UV-Projektion.
- **Punktbasierte Markierungen:** Einfaches Platzieren von nummerierten Markierungen inklusive Titel und Notizen per Mausklick auf die Knochenoberfläche.
- **Intelligente Badges:**
  - *Ruhezustand:* Minimalistischer, leuchtender Orientierungspunkt (ca. 32% Skalierung), der die anatomische Sicht freihält.
  - *Hover & Selektion:* Reibungslose Expansion zu einem voll nummerierten Badge mit Verbindungsschaft (*Stem Line*) und vergrößertem Treffervolumen.
- **Rückseiten-Transparenz (Occlusion Handling):** Markierungen, die auf der Rückseite des Modells liegen, werden transparent (~25% Deckkraft) gerendert, bleiben jedoch vollständig sichtbar und anklickbar. Ein Klick dreht die Kamera automatisch auf die entsprechende Knochenseite.
- **Flüssige 60 FPS Performance:** Analytische $O(1)$-Vektormathematik zur Verdeckungserkennung ohne teure Mesh-Raycasts im Render-Loop.
- **Schnellsuche & Filterung:** Durchsuchen der gesetzten Punkte in der Seitenleiste nach Titel oder Beschreibung.
- **Import & Export:** Dauerhafte Speicherung im Browser (`localStorage`) sowie Export und Import als standardisierte JSON-Dateien.
- **Vollständige Typsicherheit:** Vollständig in striktem **TypeScript** implementiert inklusive typisierter Datenmodelle und Schnittstellen.
- **100% Testabdeckung:** Umfassende automatisierte Test-Suite mit **Vitest** (Unit/Integration) und **Playwright** (End-to-End).

---

## Architektur & Modulübersicht

Das Projekt nutzt modernstes **TypeScript** zusammen mit **Vite** als performantem Bundler und Dev-Server. Alle Module sind modular, strikt typisiert und entkoppelt aufgebaut.

```txt
podotomy/
├── bone-texture/               # PBR-Texturdateien (Albedo, Normal, Roughness, AO)
├── src/                        # Modulare TypeScript-Anwendungsarchitektur
│   ├── camera.ts               # Kamera-Flug- & Reset-Animationen (Easing, Orbit)
│   ├── interactions.ts         # Raycasting, Maus-Events (Hover/Click), Marker-Selektion
│   ├── main.ts                 # Haupteinstiegspunkt, GLTF-Lader & 60-FPS-Renderloop
│   ├── markers.ts              # 3D-Marker-Visuals, Canvas-Badge-Texturen, Okklusionsprüfung
│   ├── materials.ts            # PBR-Knochenmaterial, Tri-Planare Box-UV-Generierung
│   ├── scene.ts                # Three.js Grundgerüst (Scene, Camera, Renderer, Lights)
│   ├── state.ts                # Zentrales reaktives App-State-Objekt (AppState)
│   ├── storage.ts              # LocalStorage-Serialisierung & JSON-Im-/Export
│   ├── types.ts                # Zentrale TypeScript-Typdefinitionen & Interfaces
│   └── ui.ts                   # DOM-Elemente, Modaldialoge, Seitenleiste, Toast-Meldungen
├── tests/
│   ├── setup.ts                # Test-Environment Setup (2D Canvas- & WebGL-Mocks)
│   ├── unit/                   # Vitest Unit- und Integrations-Tests
│   │   ├── camera.test.ts      # Tests für Kamerafahrten, Berechnungen und Reset
│   │   ├── interactions.test.ts# Tests für Interaktionsmodi und Raycast-Handling
│   │   ├── markers.test.ts     # Tests für Canvas-Badges, Skalierung und Okklusion
│   │   ├── materials.test.ts   # Tests für PBR-Materialien und Box-UVs
│   │   ├── state.test.ts       # Tests für State-Management und Reaktivität
│   │   ├── storage.test.ts     # Tests für LocalStorage, Migration und JSON-Im-/Export
│   │   └── ui.test.ts          # Tests für DOM-Rendering, Sidebar, Filter und Modale
│   └── e2e/                    # Playwright End-to-End Browser-Tests
│       └── app.spec.ts         # Komplette E2E-Workflows im echten Chromium-Browser
├── Full_Foot.glb               # 3D-GLTF-Fußmodell (zentriert, aufrecht orientiert)
├── index.html                  # HTML5-Gerüst mit Vite-Einstiegspunkt
├── package.json                # npm Abhängigkeiten, Skripte & Metadaten
├── playwright.config.ts        # Playwright E2E-Konfiguration
├── tsconfig.json               # Strikte TypeScript-Compiler-Konfiguration
├── vite.config.ts              # Vite & Vitest Konfiguration
├── style.css                   # Modernes Glassmorphism-UI-Designsystem
└── README.md                   # Projektdokumentation
```

### Modulverantwortlichkeiten

| Modul | Hauptaufgabe |
| :--- | :--- |
| `src/types.ts` | Definiert Kern-Interfaces (`AnnotationMarker`, `InteractionMode`, `AppStateInterface`, `ExportData`). |
| `src/state.ts` | Hält das globale reaktive Zustandsmodell (`AppState`), aktive Modi (`navigate` vs. `add`), Markierungsdaten und Caches. |
| `src/scene.ts` | Initialisiert WebGLRenderer, OrbitControls, Kamera, hierarchische Marker-Gruppen und das Beleuchtungs-Rig. |
| `src/materials.ts` | Lädt PBR-Maps, erzeugt `boneMaterial` und `defaultMaterial`, berechnet prozedurale Box-UV-Koordinaten. |
| `src/markers.ts` | Erzeugt 2D-Canvas-Texturen, baut 3D-Markergruppen (Sprite, Schaft, Ankerpunkt, Hit-Sphere) und prüft Okklusion. |
| `src/camera.ts` | Berechnet kubische Bézier-Flugbahnen für weiche Kamerafahrten auf ausgewählte Punkte oder die Grundansicht. |
| `src/interactions.ts` | Verwaltet Raycasting für Klick/Hover, verhindert Drag-Konflikte und projiziert das 2D-Tooltip über den 3D-Punkt. |
| `src/ui.ts` | Steuert Modale (Hinzufügen/Bearbeiten), Seitenleisten-Listenrendering, Optionen-Drawer und Toasts. |
| `src/storage.ts` | Sichert und lädt Markierungen im Browser-LocalStorage und verarbeitet JSON-Dateitransfers inkl. Validierung. |
| `src/main.ts` | Verknüpft die Module, lädt das 3D-Modell mit Fortschrittsanzeige und führt den `requestAnimationFrame`-Loop aus. |

---

## Lokale Einrichtung & Skripte

### Voraussetzungen

- **Node.js** (Version 18+ empfohlen)
- **npm** (liegt Node.js bei)

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Entwicklungsserver starten

```bash
npm run dev
```

Die Anwendung startet unter **[http://localhost:8080](http://localhost:8080)** mit automatischem Hot-Module-Replacement (HMR).

### 3. Produktions-Build erstellen

```bash
npm run build
```

Kompiliert TypeScript via `tsc` und erzeugt das optimierte, minifizierte Produktions-Bundle im Verzeichnis `dist/`.

### 4. Produktions-Vorschau starten

```bash
npm run preview
```

---

## Test-Suite (Unit, Integration & E2E)

Das Projekt verfügt über eine umfassende, automatisierte Testabdeckung auf allen Ebenen:

### Unit- und Integrationstests (Vitest + JSDOM)

Führt alle Unit- und Integrationstests für State, Materialien, Storage, Kamera, Marker, Interaktionen und UI aus:

```bash
# Einmalige Ausführung aller Unit-Tests
npm test

# Interaktiver Watch-Modus während der Entwicklung
npm run test:watch
```

### End-to-End Tests (Playwright)

Testet die vollständige Benutzeroberfläche und 3D-Interaktionen im echten Chromium-Browser:

```bash
npm run test:e2e
```

---

## 3D-Geometrie & Anatomische Konventionen

### Koordinatensystem & Ausrichtung

Das Knochenmodell `Full_Foot.glb` ist nach orthopädischen und medizinischen Konventionen ausgerichtet:

- **Y-Achse (Höhe):** Zeigt nach **oben** entlang des Schienbeins (Tibia).
- **Z-Achse (Länge):** Verläuft in Längsrichtung von der Ferse (Calcaneus) bis zu den Zehenspitzen (Phalangen).
- **X-Achse (Breite):** Verläuft transversal (medial zu lateral).
- **Kameradrehung:**
  - Horizontale Mausbewegung rotiert um die anatomische Hochachse (Y-Achse).
  - Vertikale Mausbewegung neigt den Blickwinkel (X-Achse).

### Dichte-basierte Fußzentrierung

Das Ursprungsmodell besaß einen hohen Schienbeinschaft, wodurch ein klassischer Bounding-Box-Mittelpunkt ca. 5 cm über dem eigentlichen Fuß im leeren Raum lag.
In `src/main.js` ermittelt die Funktion `getFootCentroid` das geometrische Massenzentrum anhand der **Vertex-Dichteverteilung** der Fußknochen. Dadurch rotiert das Modell exakt um das Zentrum des Fußgewölbes.

### Tri-Planare Box-UVs

Da medizinische Roh-Scans meist keine UV-Koordinaten besitzen, projiziert `generateBoxUVs()` in `src/materials.js` Koordinaten entlang der jeweils dominanten Flächennormale:

- Normale zeigt überwiegend nach oben/unten ($N_y$) $\rightarrow$ Projektion in der XZ-Ebene.
- Normale zeigt überwiegend zur Seite ($N_x$) $\rightarrow$ Projektion in der ZY-Ebene.
- Normale zeigt überwiegend nach vorn/hinten ($N_z$) $\rightarrow$ Projektion in der XY-Ebene.

### PBR-Knochenmaterial

Unter `bone-texture/` liegen 2048x2048 PBR-Texturen:

- `bone_albedo.png` (Farb- und Knochenstruktur)
- `bone_normal-ogl.png` (Mikrorelief und Poren)
- `bone_roughness.png` (Lichtstreuung matter Knochenbereiche)
- `bone_ao.png` (Tiefenschatten in Gelenkspalten)

---

## Interaktions- & Annotationssystem

### Zwei-Stufen-Badges (Idle vs. Hover/Select)

Um die Sicht auf die Knochenanatomie nicht durch große Nummernkreise zu verdecken, arbeitet das System mit zwei visuellen Zuständen:

1. **Ruhezustand (Idle):**
   - Ein dezenter, leuchtender Cyan-Punkt (`scale * 0.32`).
   - Schaftlinie ausgeblendet (`opacity: 0.0`).
   - Keine verdeckende Nummerierung.
2. **Hover- & Selektionszustand:**
   - Sobald der Mauszeiger in die Nähe des Punktes kommt (ermittelt über ein unsichtbares, optimiertes Treffervolumen `hitMesh`), expandiert der Punkt flüssig auf 100% Größe.
   - Der Badge hebt sich von der Knochenoberfläche ab und die Schaftlinie wird sichtbar.
   - Die Nummerierung (1, 2, 3...) wird hochauflösend gerendert.
   - Ein ausgewählter Punkt pulsiert sanft im Rhythmus.

### Echtzeit-Okklusionstransparenz

Punkte, die sich auf der von der Kamera abgewandten Knochenseite befinden, werden über das Skalarprodukt der Flächennormale mit dem Blickrichtungsvektor in $O(1)$ ermittelt (`updateMarkerOcclusion()`):

- **Vorderseite (`dot >= 0`):** Volle Deckkraft (`opacity: 1.0`).
- **Rückseite (`dot < 0`):** Transparente Geisterdarstellung (`opacity: 0.25 - 0.45`).
- Verdeckte Punkte bleiben durch den Knochen hindurch sichtbar und anklickbar.
- Ein Klick auf einen verdeckten Punkt startet automatisch eine Kamerafahrt auf die entsprechende Seite.

### Fokussierungs- & Kameraflug-Animation

- **Marker-Fokus:** Ein Klick auf eine Markierung (im 3D-Viewport oder über die Schaltfläche **"Fokus"** in der Seitenleiste) startet eine weiche Bézier-Kamerafahrt (`flyToPosition()`), die das Modell automatisch so dreht, dass die markierte Knochenoberfläche frontal im Blickfeld liegt.
- **Drehpunkt-Zentrierung:** Durch einen **Doppelklick** auf eine beliebige Stelle der Knochenoberfläche wird der Rotations-Drehpunkt (*Controls Target*) nahtlos auf die angeklickte Stelle zentriert.
- **Ansicht zurücksetzen:** Die Schaltfläche **"Kameraansicht zurücksetzen"** in der Navigationsleiste bringt die Kamera jederzeit in die anatomische Standardperspektive zurück.

---

## Datenpersistenz & JSON-Schnittstelle

- **Automatisches Speichern:** Jede Änderung (Punkt hinzufügen, editieren, löschen) wird sofort im browserinternen `localStorage` unter dem Schlüssel `podotomy_foot_annotations_v2` gesichert.
- **JSON-Export:** Über die Menüleiste können alle gesetzten Punkte als strukturierte `.json`-Datei exportiert werden.
- **JSON-Import:** Zuvor exportierte Annotationen können jederzeit per Drag & Drop oder Dateiauswahl wieder eingelesen werden.
- **Migration:** Altdaten früherer Versionen (`podotomy_foot_annotations_v1`) werden beim Start automatisch in das neue zentrierte Koordinatensystem migriert.
