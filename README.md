# Podotomy 3D - Interaktiver Fuß-Anatomie Annotator

**Podotomy 3D** ist eine moderne, webbasierte 3D-Anwendung zur interaktiven Erkundung, Beschriftung und Vermessung anatomischer Fußknochenstrukturen. Entwickelt mit **Three.js** und nativer **ES-Modul-Architektur** (Zero-Build-Setup), ermöglicht die Applikation das präzise Setzen von 3D-Markierungen direkt auf der Knochenoberfläche, dynamische Verdeckungserkennung (Occlusion Transparency), PBR-Knochentexturierung sowie den flexiblen Im- und Export von Annotationsdaten.

---

## Inhaltsverzeichnis

- [Funktionsübersicht](#funktionsübersicht)
- [Architektur & Modulübersicht](#architektur--modulübersicht)
- [Lokale Einrichtung & Start](#lokale-einrichtung--start)
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

---

## Architektur & Modulübersicht

Das Projekt setzt auf native Browser-ES-Module (`<script type="module">`). Dadurch wird **kein Build-Tool, Bundler oder Transpiler (wie Vite, Webpack oder Rollup)** benötigt. Die Anwendung läuft sofort in jedem modernen Webbrowser über einen einfachen statischen HTTP-Server.

Alle JavaScript-Quellcodedateien befinden sich modularisiert im Verzeichnis `src/`:

```txt
podotomy/
├── bone-texture/               # PBR-Texturdateien (Albedo, Normal, Roughness, AO)
├── src/                        # Modulare Anwendungsarchitektur (ES-Module)
│   ├── camera.js               # Kamera-Flug- & Reset-Animationen (Easing, Orbit)
│   ├── interactions.js         # Raycasting, Maus-Events (Hover/Click), Tooltip-Position
│   ├── main.js                 # Haupteinstiegspunkt, GLTF-Lader & 60-FPS-Renderloop
│   ├── materials.js            # PBR-Knochenmaterial, Tri-Planare Box-UV-Generierung
│   ├── markers.js              # 3D-Marker-Visuals, Canvas-Badge-Texturen, Okklusionsprüfung
│   ├── scene.js                # Three.js Grundgerüst (Scene, Camera, Renderer, Lights)
│   ├── state.js                # Zentrales reaktives App-State-Objekt (AppState)
│   ├── storage.js              # LocalStorage-Serialisierung & JSON-Im-/Export
│   └── ui.js                   # DOM-Elemente, Modaldialoge, Seitenleiste, Toast-Meldungen
├── Full_Foot.glb               # 3D-GLTF-Fußmodell (zentriert, aufrecht orientiert)
├── index.html                  # HTML5-Gerüst mit Three.js Import Map & Modul-Start
├── style.css                   # Modernes Glassmorphism-UI-Designsystem
└── README.md                   # Projektdokumentation
```

### Modulverantwortlichkeiten

| Modul | Hauptaufgabe |
| :--- | :--- |
| `src/state.js` | Hält das globale Zustandsmodell (`AppState`), aktive Modi (`navigate` vs. `add`), Markierungsdaten und Caches. |
| `src/scene.js` | Initialisiert WebGLRenderer, OrbitControls, Kamera, hierarchische Marker-Gruppen und das 4-Punkt-Beleuchtungs-Rig. |
| `src/materials.js` | Lädt PBR-Maps, erzeugt `boneMaterial` und `defaultMaterial`, berechnet prozedurale Box-UV-Koordinaten. |
| `src/markers.js` | Erzeugt 2D-Canvas-Texturen, baut 3D-Markergruppen (Sprite, Schaft, Ankerpunkt, Hit-Sphere) und prüft Okklusion. |
| `src/camera.js` | Berechnet kubische Bézier-Flugbahnen für weiche Kamerafahrten auf ausgewählte Punkte oder die Grundansicht. |
| `src/interactions.js` | Verwaltet Raycasting für Klick/Hover, verhindert Drag-Konflikte und projiziert das 2D-Tooltip über den 3D-Punkt. |
| `src/ui.js` | Steuert Modale (Hinzufügen/Bearbeiten), Seitenleisten-Listenrendering, Optionen-Drawer und Toasts. |
| `src/storage.js` | Sichert und lädt Markierungen im Browser-LocalStorage und verarbeitet JSON-Dateitransfers. |
| `src/main.js` | Verknüpft die Module, lädt das 3D-Modell mit Fortschrittsanzeige und führt den `requestAnimationFrame`-Loop aus. |

---

## Lokale Einrichtung & Start

Da moderne Webbrowser aus Sicherheitsgründen den Zugriff auf 3D-Modelle und ES-Module über das `file://`-Protokoll einschränken (CORS), muss das Projekt über einen lokalen HTTP-Server aufgerufen werden.

### Voraussetzungen

Ein beliebiger lokaler Webserver (z. B. Python, Node.js oder VS Code Extension).

### 1. Mit Python (empfohlen)

```bash
# Im Projektverzeichnis ausführen:
python -m http.server 8080
```

Öffne anschließend im Browser: **[http://localhost:8080](http://localhost:8080)**

### 2. Mit Node.js (`npx serve`)

```bash
npx serve . -p 8080
```

### 3. Mit Visual Studio Code

- Installiere die Extension **Live Server**.
- Klicke mit der rechten Maustaste auf `index.html` und wähle **"Open with Live Server"**.

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
