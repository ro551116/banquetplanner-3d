import * as THREE from 'three';

// Caches for sharing geometries across instances
const roundClothCache = new Map<string, THREE.BufferGeometry>();
const rectClothCache = new Map<string, THREE.BufferGeometry>();

/**
 * Creates or retrieves a procedural round tablecloth geometry with natural draped folds and rounded rim.
 */
export function getRoundTableClothGeometry(
  radius: number,
  height: number = 0.75,
  radialSegments: number = 72,
  verticalSegments: number = 18
): THREE.BufferGeometry {
  const key = `${radius.toFixed(3)}_${height.toFixed(3)}_${radialSegments}_${verticalSegments}`;
  const cached = roundClothCache.get(key);
  if (cached) return cached;

  const geom = buildRoundTableClothGeometry(radius, height, radialSegments, verticalSegments);
  roundClothCache.set(key, geom);
  return geom;
}

function buildRoundTableClothGeometry(
  radius: number,
  height: number,
  radialSegments: number,
  verticalSegments: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const yFloor = 0.02; // Hem rests 2cm above floor
  const bevelRadius = 0.025; // Soft rim rollover
  const rTop = radius - bevelRadius;
  const yTop = height;
  const yBevelEnd = height - bevelRadius;

  // Number of natural folds around the table
  const numFolds = Math.max(12, Math.round(10 + radius * 8));

  // --- 1. Center vertex ---
  positions.push(0, yTop, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);

  let vertexCount = 1;

  // --- 2. Top flat concentric rings ---
  const topRings = 3;
  for (let ring = 1; ring <= topRings; ring++) {
    const ringFrac = ring / topRings;
    const r = rTop * ringFrac;
    for (let seg = 0; seg < radialSegments; seg++) {
      const theta = (seg / radialSegments) * Math.PI * 2;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;

      positions.push(x, yTop, z);
      normals.push(0, 1, 0);
      uvs.push(0.5 + (x / (radius * 2.2)), 0.5 + (z / (radius * 2.2)));
      vertexCount++;
    }
  }

  // Indices for center fan to ring 1
  for (let seg = 0; seg < radialSegments; seg++) {
    const nextSeg = (seg + 1) % radialSegments;
    indices.push(0, 1 + seg, 1 + nextSeg);
  }

  // Indices between top rings
  for (let ring = 1; ring < topRings; ring++) {
    const rStartCurr = 1 + (ring - 1) * radialSegments;
    const rStartNext = 1 + ring * radialSegments;
    for (let seg = 0; seg < radialSegments; seg++) {
      const nextSeg = (seg + 1) % radialSegments;
      const c1 = rStartCurr + seg;
      const c2 = rStartCurr + nextSeg;
      const n1 = rStartNext + seg;
      const n2 = rStartNext + nextSeg;
      indices.push(c1, n1, c2);
      indices.push(c2, n1, n2);
    }
  }

  // --- 3. Bevel rim rings (curving from horizontal to vertical) ---
  const bevelRings = 3;
  const bevelStartIdx = vertexCount;

  for (let b = 1; b <= bevelRings; b++) {
    const bFrac = b / bevelRings;
    const phi = (bFrac * Math.PI) / 2; // 0 to 90 degrees
    const r = rTop + Math.sin(phi) * bevelRadius;
    const y = yTop - (1 - Math.cos(phi)) * bevelRadius;

    for (let seg = 0; seg < radialSegments; seg++) {
      const theta = (seg / radialSegments) * Math.PI * 2;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;

      // Normal interpolates from [0, 1, 0] to radial outward
      const ny = Math.cos(phi);
      const nr = Math.sin(phi);
      const nx = Math.sin(theta) * nr;
      const nz = Math.cos(theta) * nr;

      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      uvs.push(0.5 + (x / (radius * 2.2)), 0.5 + (z / (radius * 2.2)));
      vertexCount++;
    }
  }

  // Connect last top ring to first bevel ring, and bevel rings to each other
  const lastTopRingStart = 1 + (topRings - 1) * radialSegments;
  for (let b = 0; b < bevelRings; b++) {
    const currStart = b === 0 ? lastTopRingStart : bevelStartIdx + (b - 1) * radialSegments;
    const nextStart = bevelStartIdx + b * radialSegments;
    for (let seg = 0; seg < radialSegments; seg++) {
      const nextSeg = (seg + 1) % radialSegments;
      const c1 = currStart + seg;
      const c2 = currStart + nextSeg;
      const n1 = nextStart + seg;
      const n2 = nextStart + nextSeg;
      indices.push(c1, n1, c2);
      indices.push(c2, n1, n2);
    }
  }

  // --- 4. Skirt with undulating cloth drape folds ---
  const skirtStartIdx = vertexCount;
  const skirtH = yBevelEnd - yFloor;

  for (let v = 1; v <= verticalSegments; v++) {
    const t = v / verticalSegments; // 0 to 1
    const y = yBevelEnd - t * skirtH;

    // Flare out slightly as it hangs down
    const flare = 0.02 * Math.pow(t, 1.4);
    // Amplitude of the draped fabric folds increases toward the hem
    const foldAmp = 0.022 * Math.pow(t, 1.2);

    for (let seg = 0; seg < radialSegments; seg++) {
      const theta = (seg / radialSegments) * Math.PI * 2;
      const foldPhase = theta * numFolds;

      // Compound wave for organic cloth drape (primary pleat + soft harmonic)
      const wave = Math.sin(foldPhase) + 0.28 * Math.sin(2 * foldPhase + 0.4) + 0.12 * Math.cos(3 * foldPhase);
      const r = radius + flare + foldAmp * wave;

      // At very bottom hem, slight inward curl for finished edge
      const hemCurl = t > 0.95 ? (t - 0.95) * 0.006 : 0;
      const finalR = r - hemCurl;

      const x = Math.sin(theta) * finalR;
      const z = Math.cos(theta) * finalR;

      positions.push(x, y, z);
      // Temporary placeholder normals (computed smoothly later)
      normals.push(Math.sin(theta), 0, Math.cos(theta));

      // UV coordinates: cylindrical wrap around perimeter
      const u = (seg / radialSegments) * (numFolds * 0.5);
      const uvY = (height - y) * 2.0;
      uvs.push(u, uvY);
      vertexCount++;
    }
  }

  // Connect last bevel ring to first skirt ring, and skirt rings together
  const lastBevelRingStart = bevelStartIdx + (bevelRings - 1) * radialSegments;
  for (let v = 0; v < verticalSegments; v++) {
    const currStart = v === 0 ? lastBevelRingStart : skirtStartIdx + (v - 1) * radialSegments;
    const nextStart = skirtStartIdx + v * radialSegments;
    for (let seg = 0; seg < radialSegments; seg++) {
      const nextSeg = (seg + 1) % radialSegments;
      const c1 = currStart + seg;
      const c2 = currStart + nextSeg;
      const n1 = nextStart + seg;
      const n2 = nextStart + nextSeg;
      indices.push(c1, n1, c2);
      indices.push(c2, n1, n2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Creates or retrieves a procedural rectangular tablecloth geometry with soft drape, box pleats, and flared corner folds.
 */
export function getRectTableClothGeometry(
  width: number,
  depth: number,
  height: number = 0.75,
  cornerRadius: number = 0.04
): THREE.BufferGeometry {
  const key = `${width.toFixed(3)}_${depth.toFixed(3)}_${height.toFixed(3)}_${cornerRadius.toFixed(3)}`;
  const cached = rectClothCache.get(key);
  if (cached) return cached;

  const geom = buildRectTableClothGeometry(width, depth, height, cornerRadius);
  rectClothCache.set(key, geom);
  return geom;
}

function buildRectTableClothGeometry(
  width: number,
  depth: number,
  height: number,
  cornerRadius: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const yFloor = 0.02;
  const bevelRadius = 0.02;
  const yTop = height;
  const yBevelEnd = height - bevelRadius;

  const halfW = width / 2;
  const halfD = depth / 2;
  const innerW = halfW - cornerRadius;
  const innerD = halfD - cornerRadius;

  // Sample points around rounded rectangle perimeter
  // 4 corners with cornerSegments each + straight edges with edgeSegments
  const cornerSegments = 8;
  const longEdgeSegments = Math.max(8, Math.round(width * 8));
  const shortEdgeSegments = Math.max(6, Math.round(depth * 8));

  interface PerimeterPoint {
    x: number;
    z: number;
    nx: number;
    nz: number;
    dist: number;
    isCorner: boolean;
  }

  const perimeter: PerimeterPoint[] = [];
  let totalPerimeter = 0;

  function addPoint(x: number, z: number, nx: number, nz: number, isCorner: boolean) {
    if (perimeter.length > 0) {
      const prev = perimeter[perimeter.length - 1];
      const d = Math.hypot(x - prev.x, z - prev.z);
      totalPerimeter += d;
    }
    perimeter.push({ x, z, nx, nz, dist: totalPerimeter, isCorner });
  }

  // 1. Front edge (+Z) from -innerW to +innerW
  for (let i = 0; i <= longEdgeSegments; i++) {
    const t = i / longEdgeSegments;
    const x = -innerW + t * (2 * innerW);
    addPoint(x, halfD, 0, 1, false);
  }

  // 2. Front-Right corner (+X, +Z)
  for (let i = 1; i <= cornerSegments; i++) {
    const angle = (i / cornerSegments) * (Math.PI / 2);
    const x = innerW + Math.sin(angle) * cornerRadius;
    const z = innerD + Math.cos(angle) * cornerRadius;
    addPoint(x, z, Math.sin(angle), Math.cos(angle), true);
  }

  // 3. Right edge (+X) from +innerD to -innerD
  for (let i = 1; i <= shortEdgeSegments; i++) {
    const t = i / shortEdgeSegments;
    const z = innerD - t * (2 * innerD);
    addPoint(halfW, z, 1, 0, false);
  }

  // 4. Back-Right corner (+X, -Z)
  for (let i = 1; i <= cornerSegments; i++) {
    const angle = Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
    const x = innerW + Math.sin(angle) * cornerRadius;
    const z = -innerD + Math.cos(angle) * cornerRadius;
    addPoint(x, z, Math.sin(angle), Math.cos(angle), true);
  }

  // 5. Back edge (-Z) from +innerW to -innerW
  for (let i = 1; i <= longEdgeSegments; i++) {
    const t = i / longEdgeSegments;
    const x = innerW - t * (2 * innerW);
    addPoint(x, -halfD, 0, -1, false);
  }

  // 6. Back-Left corner (-X, -Z)
  for (let i = 1; i <= cornerSegments; i++) {
    const angle = Math.PI + (i / cornerSegments) * (Math.PI / 2);
    const x = -innerW + Math.sin(angle) * cornerRadius;
    const z = -innerD + Math.cos(angle) * cornerRadius;
    addPoint(x, z, Math.sin(angle), Math.cos(angle), true);
  }

  // 7. Left edge (-X) from -innerD to +innerD
  for (let i = 1; i <= shortEdgeSegments; i++) {
    const t = i / shortEdgeSegments;
    const z = -innerD + t * (2 * innerD);
    addPoint(-halfW, z, -1, 0, false);
  }

  // 8. Front-Left corner (-X, +Z)
  for (let i = 1; i < cornerSegments; i++) {
    const angle = (3 * Math.PI) / 2 + (i / cornerSegments) * (Math.PI / 2);
    const x = -innerW + Math.sin(angle) * cornerRadius;
    const z = innerD + Math.cos(angle) * cornerRadius;
    addPoint(x, z, Math.sin(angle), Math.cos(angle), true);
  }

  const numPerim = perimeter.length;

  // --- Top flat surface ---
  // Center vertex
  positions.push(0, yTop, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);

  // Top perimeter points (inset slightly by bevelRadius)
  for (let i = 0; i < numPerim; i++) {
    const p = perimeter[i];
    const x = p.x - p.nx * bevelRadius;
    const z = p.z - p.nz * bevelRadius;
    positions.push(x, yTop, z);
    normals.push(0, 1, 0);
    uvs.push(0.5 + x / width, 0.5 + z / depth);
  }

  for (let i = 0; i < numPerim; i++) {
    const next = (i + 1) % numPerim;
    indices.push(0, 1 + i, 1 + next);
  }

  // --- Bevel Rim ---
  const bevelStart = 1 + numPerim;
  for (let i = 0; i < numPerim; i++) {
    const p = perimeter[i];
    positions.push(p.x, yBevelEnd, p.z);
    normals.push(p.nx * 0.707, 0.707, p.nz * 0.707);
    uvs.push(0.5 + p.x / width, 0.5 + p.z / depth);
  }

  for (let i = 0; i < numPerim; i++) {
    const next = (i + 1) % numPerim;
    const t1 = 1 + i;
    const t2 = 1 + next;
    const b1 = bevelStart + i;
    const b2 = bevelStart + next;
    indices.push(t1, b1, t2);
    indices.push(t2, b1, b2);
  }

  // --- Skirt with vertical pleats and corner drape ---
  const vSteps = 14;
  const skirtH = yBevelEnd - yFloor;
  let prevRowStart = bevelStart;

  for (let v = 1; v <= vSteps; v++) {
    const t = v / vSteps; // 0 to 1
    const y = yBevelEnd - t * skirtH;
    const rowStart = positions.length / 3;

    const foldAmp = 0.016 * Math.pow(t, 1.2);
    const cornerFlare = 0.028 * Math.pow(t, 1.3);

    for (let i = 0; i < numPerim; i++) {
      const p = perimeter[i];

      // Soft vertical ripples along the sides
      const pleatWave = Math.sin(p.dist * 18) * 0.7 + Math.sin(p.dist * 36) * 0.3;
      const sideDisp = (!p.isCorner ? foldAmp * pleatWave : 0);

      // Flared diagonal drape at the corners
      const cornerDisp = (p.isCorner ? cornerFlare : 0);
      const totalDisp = sideDisp + cornerDisp;

      const x = p.x + p.nx * totalDisp;
      const z = p.z + p.nz * totalDisp;

      positions.push(x, y, z);
      normals.push(p.nx, 0, p.nz);

      const u = p.dist * 2.0;
      const vCoord = (height - y) * 2.0;
      uvs.push(u, vCoord);
    }

    for (let i = 0; i < numPerim; i++) {
      const next = (i + 1) % numPerim;
      const c1 = prevRowStart + i;
      const c2 = prevRowStart + next;
      const n1 = rowStart + i;
      const n2 = rowStart + next;
      indices.push(c1, n1, c2);
      indices.push(c2, n1, n2);
    }

    prevRowStart = rowStart;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Creates or retrieves a draped backdrop curtain geometry with natural vertical gathered folds.
 */
export function createBackdropClothGeometry(
  width: number,
  height: number,
  pleatSpacing: number = 0.16
): THREE.BufferGeometry {
  const xSegments = Math.max(16, Math.round(width / (pleatSpacing / 4)));
  const ySegments = 16;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const pleatFreq = (Math.PI * 2) / pleatSpacing;
  const foldDepth = 0.035; // 3.5cm depth of drape waves

  for (let iy = 0; iy <= ySegments; iy++) {
    const ty = iy / ySegments; // 0 (bottom) to 1 (top)
    const y = ty * height;

    // Folds hang slightly deeper near bottom, gathered tight at top
    const depthScale = 0.8 + 0.2 * (1 - ty);

    for (let ix = 0; ix <= xSegments; ix++) {
      const tx = ix / xSegments;
      const x = -width / 2 + tx * width;

      // Vertical accordion drape waves with secondary harmonic
      const wave = Math.sin(x * pleatFreq) * 0.85 + Math.sin(x * pleatFreq * 2 + 0.5) * 0.15;
      const z = wave * foldDepth * depthScale;

      positions.push(x, y, z);
      normals.push(0, 0, 1); // Will be recomputed
      uvs.push(tx * (width * 2), ty * (height * 2));
    }
  }

  const rowSize = xSegments + 1;
  for (let iy = 0; iy < ySegments; iy++) {
    for (let ix = 0; ix < xSegments; ix++) {
      const a = iy * rowSize + ix;
      const b = (iy + 1) * rowSize + ix;
      const c = (iy + 1) * rowSize + (ix + 1);
      const d = iy * rowSize + (ix + 1);
      indices.push(a, b, d);
      indices.push(d, b, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}
export const getBackdropClothGeometry = createBackdropClothGeometry;

/**
 * Creates or retrieves a pleated stage skirt geometry with crisp vertical box pleats.
 */
export function createStagePleatedSkirtGeometry(
  length: number,
  height: number,
  pleatSpacing: number = 0.12
): THREE.BufferGeometry {
  const xSegments = Math.max(12, Math.round(length / 0.025));
  const ySegments = 6;
  const pleatFreq = (Math.PI * 2) / pleatSpacing;
  const pleatDepth = 0.012;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= ySegments; iy++) {
    const ty = iy / ySegments;
    const y = ty * height;
    for (let ix = 0; ix <= xSegments; ix++) {
      const tx = ix / xSegments;
      const x = -length / 2 + tx * length;
      const z = Math.sin(x * pleatFreq) * pleatDepth;

      positions.push(x, y, z);
      normals.push(0, 0, 1);
      uvs.push(tx * (length * 3), ty * (height * 3));
    }
  }

  const rowSize = xSegments + 1;
  for (let iy = 0; iy < ySegments; iy++) {
    for (let ix = 0; ix < xSegments; ix++) {
      const a = iy * rowSize + ix;
      const b = (iy + 1) * rowSize + ix;
      const c = (iy + 1) * rowSize + (ix + 1);
      const d = iy * rowSize + (ix + 1);
      indices.push(a, b, d);
      indices.push(d, b, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}
export const getStagePleatedSkirtGeometry = createStagePleatedSkirtGeometry;
