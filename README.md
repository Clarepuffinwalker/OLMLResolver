# OLML Resolver Web

OLML (Object-linked Memory Language) is a package format for linking a physical or identifiable object with one or more human memories and their files. An OLML package carries the object, its markers, memories, links, and related assets together.

## OLML core repository

**Repository:**
[OLML Core](https://github.com/Clarepuffinwalker/OLML)

## This web app

OLML Resolver Web is a browser-local prototype. It runs locally, without a server, to create, edit, read, import, and export `.olml` files. Its library is stored in the browser on the current origin; opening the app on another browser or port starts with a separate local library.

Client applications for phones, glasses, and other devices may come later.

## Run locally

```bash
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173).

For camera scanning, use `localhost` or HTTPS and allow camera access.

## Try the sample data

Open either package from [`../MemoryPackage`](../MemoryPackage):

- `olml-white-acrylic-panel-olml-demo-collection-01-white.olml`
- `olml-black-acrylic-panel-olml-demo-collection-01.olml`

They are two acrylic-panel examples for trying the reader, local library, and resolver flow.

## What it can do now

- Create, edit, validate, save, export, and read OLML packages locally.
- Keep a browser-local library of opened or saved packages.
- Link one object to one or more memories and bundled or referenced assets.
- Scan **QR / barcode** or **OCR text** in separate modes, then resolve a matching value against the local library.
- Import and export a lightweight catalog of local-library metadata.

## Planned later

- Client apps for phones, glasses, and other devices.
- Broader marker and device support.
- Shared or server-backed discovery, viewing, and collaboration where appropriate.
- More mature interoperability and production packaging around the OLML core.

## Current boundary

This is a local prototype, not a hosted discovery service. A scan can open only an OLML package already saved in this browser-local library (or a catalog entry with a configured location); it does not search the public web or a remote registry automatically.

## Website

[olml.org](https://olml.org)
