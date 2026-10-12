
# NoX Map Engine

**Bring your maps to life.**

NoX Map Engine is an open-source, reusable mapping engine for building interactive, explorable maps in web applications.

From fictional worlds and illustrated landscapes to geographic maps and custom spatial interfaces, NoX Map Engine provides the tools to display, navigate, and interact with map-based content without building an entire mapping system from scratch.

It combines high-performance rendering, interactive entities, customizable layers, flexible data sources, and a standalone viewer — all built around a modular, application-independent architecture.

**Interactive maps · Custom worlds · Modular architecture · Framework-independent · Open source**

---

## What is NoX Map Engine?

Not every map represents the real world.

Some maps describe imaginary continents, buildings, game worlds, fictional cities, or entirely custom environments. Others require real-world coordinates, geographic information, and conventional map tiles.

NoX Map Engine is designed to support both.

Instead of forcing every application into a specific mapping platform or data model, it provides a reusable foundation for displaying and interacting with spatial content.

You provide the map, its entities, and their associated information. NoX Map Engine handles rendering, navigation, interactions, selection, and map state.

The engine can be embedded into an existing application or used through its included standalone viewer, **NoX Atlas**.

## What can you build?

NoX Map Engine is designed for projects where locations and spatial relationships are an important part of the experience.

| Use case | Examples |
| --- | --- |
| **Fantasy worlds** | Interactive continents, kingdoms, settlements, landmarks, and points of interest. |
| **Game maps** | Explorable game worlds with locations, regions, and contextual information. |
| **Knowledge bases** | Maps connected to articles, documents, characters, or other structured content. |
| **Geographic applications** | Real-world locations, coordinate-based markers, and geographic overlays. |
| **Interactive diagrams** | Building plans, facility layouts, campuses, and custom spatial interfaces. |
| **Embedded experiences** | Mapping interfaces integrated into websites, applications, and WebViews. |

The engine does not impose domain-specific concepts such as kingdoms, cities, quests, or buildings.

Those belong to the application using it.

## Features

### Interactive map navigation

Explore maps using familiar navigation controls.

- Pan by dragging the map.
- Zoom using the mouse wheel, touch gestures, or navigation controls.
- Navigate with keyboard interactions.
- Fit the map to its boundaries.
- Center the view on specific entities.
- Navigate programmatically using the engine API.
- Convert between map coordinates and screen positions.

The engine supports both mouse and touch interactions, with configurable gesture behavior for embedded or standalone experiences.

### Local and geographic maps

NoX Map Engine supports two coordinate models.

**Local coordinates**

Designed for illustrated maps, fantasy worlds, diagrams, floor plans, and environments where conventional geographic coordinates are unnecessary.

Local maps use a configurable coordinate system with an origin, dimensions, and scale.

This makes it possible to define locations directly within your map's own coordinate space.

**Geographic coordinates**

Designed for real-world mapping.

Geographic maps use WGS84 longitude and latitude coordinates, with support for conventional XYZ map tiles using Web Mercator.

Both models share the same engine API for navigation, entities, layers, and interactions.

### Large map support

Explore detailed maps without requiring the browser to load an entire high-resolution image at once.

NoX Map Engine supports raster tile pyramids, dividing large map images into smaller tiles at multiple resolution levels.

As users navigate, the renderer loads the relevant tiles for the current view.

This approach helps manage rendering and memory requirements for large maps.

Supported raster sources include:

- Regular image sources for smaller maps.
- Multiresolution raster tile pyramids.
- Geographic XYZ tile sources.

An included command-line utility can prepare large raster images for use with the engine.

### Interactive entities

Maps become more useful when their contents can be explored.

NoX Map Engine supports interactive entities with their own identities, geometries, styles, and associated information.

Entities can represent anything from a single location to an entire region.

Supported geometries include:

- **Points** — Individual locations, markers, or landmarks.
- **Polygons** — Areas, territories, regions, and boundaries.
- **MultiPolygons** — Entities composed of multiple distinct areas.

Each entity can contain:

- A unique identifier.
- A label and description.
- Custom metadata.
- Styling information.
- References to related content.

Users can interact with entities directly on the map.

The engine supports hover feedback, selection, focus, and programmatic access to entity data.

### Layers and visual customization

Organize map content into independent layers.

Layers control how different types of information are displayed and allow applications to present complex maps without merging everything into a single visual surface.

Features include:

- Raster and vector layers.
- Configurable layer ordering.
- Layer visibility controls.
- Layer opacity.
- Zoom-dependent visibility.
- Custom visual styles.
- Entity-specific hover and selection styles.

Styling supports fills, strokes, icons, labels, sizes, and other visual properties.

Applications can also provide style callbacks to customize how entities are presented.

### Marker clustering

Dense maps can contain thousands of markers.

NoX Map Engine includes configurable clustering to group nearby markers and reduce visual clutter.

Clusters respond to the current map view and support interaction with their contained entities.

Applications can inspect cluster members and decide how to present or navigate them.

### Contextual information and content references

Entities can carry information beyond their position on the map.

For example, a city might reference a wiki article, a landmark might reference an image gallery, or a building might reference an application-specific record.

NoX Map Engine exposes these connections through structured content references.

```json id="oo0vep"
{
  "id": "ancient-city",
  "layerId": "locations",
  "label": "The Ancient City",
  "description": "A forgotten settlement beyond the mountains.",
  "geometry": {
    "type": "Point",
    "coordinates": [420, 275]
  },
  "metadata": {
    "category": "settlement",
    "region": "Northern Highlands"
  },
  "contentRefs": [
    {
      "type": "document",
      "ref": "locations/ancient-city",
      "title": "Read more"
    }
  ]
}
```

The engine reports content activation events but does not decide how application-specific references should be opened.

Your application can connect these events to a wiki, database, navigation system, or another service.

This keeps the mapping engine independent from the content systems built around it.

### Deep links and shareable views

NoX Map Engine supports serializing and restoring map navigation state.

A saved view can include:

- Map identity.
- Snapshot identity.
- Camera position and zoom.
- Selected entity.
- Layer visibility.

This makes it possible to share a link that opens a particular map at a specific location.

The standalone viewer integrates this behavior with browser history, allowing users to navigate backward and forward between supported map states.

Applications embedding the engine can implement their own URL and routing behavior using the same state serialization API.

### Dynamic entity management

Applications can change map content during a session.

The engine provides operations to:

- Add entities.
- Update existing entities.
- Remove entities.
- Show or hide layers.
- Change layer opacity.
- Select or clear selected entities.
- Navigate to individual locations.

Changes are reflected in the active map without requiring the entire application to reload.

These changes are **session-local**. Persistence is managed by the application or data source, not by the engine itself.

### Flexible data sources

NoX Map Engine separates map rendering from data retrieval.

Its `MapDataSource` interface defines how maps, snapshots, and assets are obtained.

The included static HTTP provider can load map data from ordinary JSON files and assets served over HTTP.

Applications can implement custom providers for:

- Remote APIs.
- Private content services.
- Application backends.
- Custom storage systems.
- Versioned map collections.

Authentication and transport details remain the responsibility of the provider.

This architecture allows different applications to reuse the same mapping engine without changing its rendering or interaction logic.

### Framework-independent integration

NoX Map Engine can be used inside a regular web page or integrated into applications built with modern frontend frameworks.

The engine manages its own rendering lifecycle and exposes a typed API for application integration.

Examples are included for:

- Vanilla JavaScript and TypeScript.
- React.
- WebView-based applications.

A WebView example demonstrates how a native host can provide data and receive selection events.

The current repository includes a WebView integration example; native-device compatibility still requires validation on the target platforms.

### Performance-conscious rendering

The engine is designed to handle map navigation and interaction with large datasets.

Its rendering architecture includes:

- Raster tile loading and asset management.
- Vector rendering for markers and polygons.
- Spatial indexing for entity interaction.
- Marker clustering.
- Label decluttering.
- Batched entity updates.
- Separate selection and hover presentation.
- Cleanup of listeners, observers, and renderer resources.

The repository includes a benchmark scenario with:

| Benchmark dataset | Size |
| --- | --- |
| Map coordinate space | 50,000 × 50,000 units |
| Markers | 10,000 |
| Polygons | 1,000 |
| Total polygon vertices | 101,000 |

Automated benchmarks and browser tests are available.

These measurements provide a development baseline, not a guarantee of identical performance across hardware, browsers, and real-world datasets.

---

## NoX Atlas — Standalone viewer

NoX Map Engine includes **NoX Atlas**, a standalone web viewer built using the engine itself.

It provides a ready-to-use interface for exploring maps without first developing a custom frontend.

### Explore your maps

NoX Atlas includes:

- A map selector for switching between available maps.
- An interactive map viewport.
- A sidebar with available layers.
- Visibility controls for individual layers.
- A searchable list of map entities.
- Entity selection and contextual details.
- Navigation and zoom controls.
- Coordinate and map information.
- Shareable links to the current view.

### Included demonstration maps

The repository includes two sample maps:

| Map | Description |
| --- | --- |
| **Costa de Esmeralda** | An illustrated map demonstrating local coordinates, custom entities, layers, and interactions. |
| **Lisboa** | A geographic map demonstrating real-world coordinates and XYZ map tiles. |

The illustrated map can run using local assets.

The geographic demonstration uses OpenStreetMap tiles and requires network access.

NoX Atlas can also be configured to load your own map catalog.

---

## Getting started

### Requirements

To run the project locally:

- Node.js 24 LTS
- npm 11

### Run NoX Atlas

Clone the repository:

```bash id="wjm3s5"
git clone https://github.com/mapherez/nox-map-engine.git
```

This downloads the project into a new local directory without modifying your existing applications.

Enter the project directory:

```bash id="4v3x71"
cd nox-map-engine
```

Install the project's dependencies:

```bash id="94sc4v"
npm ci
```

This installs the versions recorded in `package-lock.json`. It does not start the application.

Start the development viewer:

```bash id="o4ywkp"
npm run dev
```

This starts the local Vite development server.

Open:

**<http://127.0.0.1:5173>**

The included map catalog is loaded automatically.

You can switch between the demonstration maps, navigate, interact with entities, and explore the available layers.

## Use your own maps

NoX Map Engine supports custom map collections through a structured catalog and map manifests.

You can prepare a raster image using the included CLI or provide an existing compatible map dataset.

### Prepare a large image

The CLI converts a raster image into a map-ready tile pyramid.

For example:

```bash id="f486c3"
npm run prepare-map -- prepare ./world-map.png --out ./my-world --map-id my-world --title "My World"
```

This reads `world-map.png`, generates the required tiles and supporting files, and creates a new `my-world` directory.

It does not overwrite an existing output directory.

The generated structure includes:

```text id="wb48bn"
my-world/
├── catalog.json
├── map.json
├── entities.json
├── thumbnail.png
└── tiles/
    └── {z}/{x}/{y}.png
```

The generated `entities.json` starts empty, ready for map entities to be added using the supported data format.

Additional CLI options allow you to configure the map scale, snapshot identity, output format, and initial view.

See [Data Format](docs/data-format.md) for supported map definitions, coordinates, layers, and entities.

### Load a custom catalog

The standalone viewer reads its configuration from:

`apps/standalone/public/config.json`

Example:

```json id="f85umg"
{
  "provider": "static-http",
  "catalogUrl": "./maps/catalog.json",
  "gestures": "exclusive"
}
```

To use your own collection, serve the generated files over HTTP and configure `catalogUrl` to point to the corresponding catalog.

The catalog can contain multiple maps, each with its own snapshots and supporting assets.

The standalone viewer requires an HTTP server; opening the built application directly with `file://` is not supported.

---

## Integrating NoX Map Engine

NoX Map Engine is also available as a collection of reusable TypeScript packages within the repository.

### Basic example

After building the local packages and making them available to your application, create a map engine instance:

```typescript id="q42rby"
import { createMapEngine } from '@nox-map/engine';
import { StaticHttpDataSource } from '@nox-map/data-source-static';
import '@nox-map/engine/style.css';

const engine = createMapEngine({
  container: document.querySelector<HTMLElement>('#map')!,
  dataSource: new StaticHttpDataSource({
    catalogUrl: '/maps/catalog.json'
  }),
  gestures: 'cooperative'
});

const unsubscribe = engine.on('selectionchange', ({ entity }) => {
  if (!entity) return;

  console.log('Selected:', entity.label);
  console.log('Metadata:', entity.metadata);
  console.log('Content:', entity.contentRefs);
});

await engine.loadMap('my-world');

// Navigate to a position.
engine.setView({
  center: [500, 400],
  zoom: 1
});

// Save the current view state.
const viewState = engine.serializeViewState();

// Clean up when the component is removed.
unsubscribe();
engine.destroy();
```

The target container must have defined dimensions.

The engine does not create an application router, change the browser URL, or persist edited map data automatically.

Those responsibilities remain with the host application.

### Engine API

The public API provides methods for navigation, inspection, interaction, and session updates.

| Method | Purpose |
| --- | --- |
| `loadMap()` | Load a map and its snapshot. |
| `getState()` | Get the current engine state. |
| `getMap()` | Read the active map definition. |
| `getEntities()` | Retrieve map entities. |
| `setView()` | Change the camera position and zoom. |
| `fitBounds()` | Fit the map or a defined area into view. |
| `focusEntity()` | Navigate to an entity. |
| `selectEntity()` | Select an entity. |
| `pick()` | Find entities at a screen position. |
| `setLayerVisibility()` | Show or hide a layer. |
| `setLayerOpacity()` | Change a layer's opacity. |
| `upsertEntities()` | Add or update session entities. |
| `removeEntities()` | Remove session entities. |
| `serializeViewState()` | Create a shareable navigation state. |
| `applyViewState()` | Restore a saved navigation state. |
| `destroy()` | Release engine resources. |

The engine also exposes typed events for map changes, selection, navigation, entity updates, loading, errors, and other interactions.

For the complete API, see [API Documentation](docs/api.md).

### Integration examples

The repository provides ready-made examples for different environments.

Start the example development server:

```bash id="jdo9z2"
npm run dev:examples
```

This starts a local Vite server for the integration examples. It does not deploy or modify an external application.

Open:

| Example | URL |
| --- | --- |
| Vanilla Web | <http://127.0.0.1:5174/web/> |
| React | <http://127.0.0.1:5174/react/> |
| WebView | <http://127.0.0.1:5174/webview/> |

These examples demonstrate how applications can initialize the engine, provide map data, receive selection events, and manage its lifecycle.

---

## Architecture

NoX Map Engine uses a modular package architecture.

| Package | Responsibility |
| --- | --- |
| `@nox-map/core` | Shared types, validation, coordinates, GeoJSON support, and view-state serialization. |
| `@nox-map/engine` | Map lifecycle, application state, events, and high-level operations. |
| `@nox-map/renderer-openlayers` | Rendering, navigation, picking, and spatial visualization. |
| `@nox-map/data-source-static` | Static HTTP and in-memory data providers. |
| `@nox-map/controls` | Optional navigation controls, tooltips, and entity details. |
| `@nox-map/cli` | Raster preparation and tile generation. |

The architecture separates three responsibilities:

**Data** — Where map definitions, entities, and assets come from.

**Engine** — How map state, navigation, selection, and interactions are coordinated.

**Rendering** — How maps and entities are visually presented.

The current renderer uses OpenLayers, but the engine exposes a renderer interface so alternative implementations can be developed without changing the public application-facing API.

NoX Map Engine does not require a dedicated backend for static map collections.

## Testing and validation

The repository includes automated tests covering:

- Map data and schema validation.
- Coordinate transformations.
- Rendering and entity interactions.
- Marker clustering and polygon picking.
- Data source behavior.
- Navigation and view-state restoration.
- Responsive and touch interactions.
- Accessibility checks.
- Resource cleanup.
- Production builds and package exports.

Browser tests cover Chromium, Firefox, WebKit, and an emulated mobile environment.

The project also provides performance benchmarks for large synthetic map datasets.

**Current release status:** The core implementation for version `0.1.0` is present and the latest repository CI run passed. Final physical-device testing and production performance validation remain pending.

See [Release Validation](docs/release-checklist.md) for the remaining acceptance requirements.

## Current scope and future integrations

NoX Map Engine focuses on being a reusable mapping foundation rather than an application-specific editing or content management platform.

The current version provides interactive viewing, custom data sources, navigation, entity operations, and integration APIs.

The following capabilities are not included in the current release:

- Built-in visual map editing.
- Persistent map editing or content management.
- Real-time synchronization between clients.
- Turn-by-turn routing or pathfinding.
- Complete offline asset management.
- Arbitrary GIS formats and coordinate systems.

### NoX Sync

A dedicated NoX Sync data source adapter is planned for a future phase.

The existing provider architecture is designed to allow external integrations without introducing NoX Sync-specific assumptions into the core mapping engine.

NoX Sync connectivity is **not yet implemented** in this repository.

---

## Documentation

Technical documentation is available in the `docs/` directory.

- [Architecture](docs/architecture.md) — Design decisions, internal boundaries, and rendering architecture.
- [API and Providers](docs/api.md) — Engine API, events, view states, and custom data sources.
- [Data Format](docs/data-format.md) — Map manifests, coordinate systems, assets, entities, and styles.
- [Release Validation](docs/release-checklist.md) — Automated tests, performance benchmarks, and outstanding validation.

## Project status

NoX Map Engine is currently at version **0.1.0**.

The core mapping functionality, standalone viewer, developer integration examples, raster preparation CLI, and automated test infrastructure are implemented.

The project is undergoing final validation for its initial release, including performance and compatibility testing on physical devices.

---

**NoX Map Engine** — Build worlds. Connect places. Explore everything.

Developed by [Mapherez](https://github.com/mapherez).
