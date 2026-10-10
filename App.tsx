import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { BanquetObject, DeviceSystem, LightMount, ObjectType, PathPoint, TrussStructureConfig } from './types';
import { createObjectConfig, INITIAL_HALL, withLightMount } from './constants';
import { cloneTrussConfig, getTrussDimensions } from './trussConfig';
import { CLOSABLE_PATH_TYPES, DEVICE_SYSTEMS, findTableUnder, getTableTop, getTrussBeams, isOnTable, isPathType, MIN_OUTLINE_POINTS, nextDeviceCode, pathVertexLimits, TRUSS_MOUNT_TYPES, trussMountPose, TrussMountPose, withOutline } from './planning';
import { useObjects } from './hooks/useObjects';
import { useDrawing } from './hooks/useDrawing';
import { useSceneIO, captureThumbnail } from './hooks/useSceneIO';
import { useKeyboard } from './hooks/useKeyboard';
import { TopToolbar, ViewControls, DrawingControls } from './components/TopToolbar';
import { ShortcutHelpDialog } from './components/ShortcutHelpDialog';
import { scenesApi } from './services/scenesApi';
import { Sidebar } from './components/Sidebar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { AdvancedAddModal } from './components/AdvancedAddModal';
import StatusBar from './components/StatusBar';
import { SceneCanvas } from './components/SceneCanvas';
import { SceneManager } from './components/SceneManager';
import { HomeMenu } from './components/HomeMenu';
import { AddObjectPanel } from './components/AddObjectPanel';
import { getObjectLabel } from './components/objectTypeMeta';
import { TrussBuilderModal } from './components/TrussBuilderModal';
import { TrussSheetModal } from './components/TrussSheetModal';
import { FloorPlanModal } from './components/FloorPlanModal';
import { TrussStudio } from './components/TrussStudio';
import { EditorControls } from './components/EditorControls';
import { EditTool, EditorSession } from './interaction';
import { DOCKED_PANELS_QUERY, useMediaQuery } from './components/ui/useMediaQuery';
import { SceneConflictDialog } from './components/SceneConflictDialog';
import { EditorErrorBoundary } from './components/EditorErrorBoundary';

export default function App() {
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'scenes' | 'trussStudio'>('home');
  const [mode, setMode] = useState<'EDIT' | 'VIEW'>('EDIT');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hall, setHall] = useState(INITIAL_HALL);
  const [isDragging, setIsDragging] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);
  const [viewRequest, setViewRequest] = useState(0);
  const [viewEnvironment, setViewEnvironment] = useState<'day' | 'night'>('day');
  const [showLabels, setShowLabels] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState<BanquetObject[] | null>(null);
  const [editTool, setEditTool] = useState<EditTool>('move');
  const [snapStep, setSnapStep] = useState(0.1);
  const editorSessionRef = useRef<EditorSession | null>(null);
  const docked = useMediaQuery(DOCKED_PANELS_QUERY);
  const [panelOpen, setPanelOpen] = useState(docked);
  const [addPanelOpen, setAddPanelOpen] = useState(docked);
  // Crossing the dock breakpoint (window resize, tablet rotation): docked layouts show both panels,
  // sheets start closed so two bottom sheets never stack.
  useEffect(() => {
    setPanelOpen(docked);
    setAddPanelOpen(docked);
  }, [docked]);
  const [showTrussBuilder, setShowTrussBuilder] = useState(false);
  const [editingTrussId, setEditingTrussId] = useState<string | null>(null);
  const [showTrussSheet, setShowTrussSheet] = useState(false);
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  /** World-XZ vertices of the path object or hall outline being drawn. */
  const [pathDraft, setPathDraft] = useState<PathPoint[]>([]);
  const [drawingOutline, setDrawingOutline] = useState(false);
  /** System used for the next device point placed from the palette. */
  const [deviceSystem, setDeviceSystem] = useState<DeviceSystem>('network');
  /** Mount used for the next light placed from the palette. */
  const [lightMount, setLightMount] = useState<LightMount>('floor');
  const [isExiting, setIsExiting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const showNotice = useCallback((message: string, error = false) => setToast({ message, error }), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const objectRefs = useRef<Record<string, THREE.Group | null>>({});

  const {
    objects, setObjects, resetObjects, updateObject, deleteObject,
    deleteByIds, handleBatchUpdate, handleBulkPropertyUpdate,
    handleBatchAddObjects, duplicateObjects, handleAddStair, handleRemoveStair,
    handleUpdateStair, undo, redo, canUndo, canRedo
  } = useObjects();
  useEffect(() => {
    const existing = new Set(objects.map(object => object.id));
    setSelectedIds(previous => {
      const next = new Set([...previous].filter(id => existing.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [objects]);

  const drawing = useDrawing();

  const cancelEditing = useCallback(() => {
    if (editorSessionRef.current?.cancel()) return true;
    if (pendingPlacement) {
      setPendingPlacement(null);
      return true;
    }
    if (drawingOutline) {
      setDrawingOutline(false);
      setPathDraft([]);
      return true;
    }
    if (drawing.isDrawMode || drawing.currentPath.length) {
      drawing.cancelPath();
      drawing.setIsDrawMode(false);
      return true;
    }
    return false;
  }, [pendingPlacement, drawingOutline, drawing.isDrawMode, drawing.currentPath.length, drawing.cancelPath, drawing.setIsDrawMode]);

  const sceneIO = useSceneIO({
    sceneId, hall, objects, drawings: drawing.drawings,
    setHall, setObjects, resetObjects, setDrawings: drawing.setDrawings,
    setSelectedIds, setIsDrawMode: drawing.setIsDrawMode, setMode, onNotice: showNotice
  });
  useEffect(() => {
    if (sceneIO.saveError && (sceneIO.saveStatus === 'error' || sceneIO.saveStatus === 'conflict')) {
      showNotice(sceneIO.saveError, true);
    }
  }, [sceneIO.saveError, sceneIO.saveStatus, showNotice]);

  useKeyboard({
    enabled: sceneId !== null && sceneIO.saveStatus !== 'conflict' && !showTrussBuilder && !showTrussSheet && !showFloorPlan && !showBatchModal && !showShortcutHelp && !toolbarMenuOpen && !sceneIO.isLoading && !isExiting,
    mode, selectedIds, objects,
    deleteByIds, handleBatchUpdate,
    setSelectedIds, setIsDrawMode: drawing.setIsDrawMode,
    undo, redo, duplicateObjects,
    onCancel: cancelEditing, busy: isDragging || pendingPlacement !== null || drawingOutline,
    tool: editTool, setTool: tool => { cancelEditing(); setEditTool(tool); }, snapStep
  });

  const handleLoadScene = useCallback(async (id: string, discardLocal = false) => {
    setLoadError(null);
    const ok = await sceneIO.loadScene(id, discardLocal);
    if (ok) {
      setView('scenes');
      setSceneId(id);
    } else {
      setLoadError('無法載入該場景，請稍後再試。');
      showNotice('無法載入該場景，請稍後再試。', true);
    }
    return ok;
  }, [sceneIO.loadScene, showNotice]);

  const handleNewScene = useCallback(async (id: string) => {
    setLoadError(null);
    const ok = await sceneIO.loadScene(id);
    if (ok) {
      setView('scenes');
      setSceneId(id);
    } else {
      setLoadError('無法載入新建立的場景，請稍後再試。');
    }
  }, [sceneIO.loadScene]);

  const handleBackToList = useCallback(async () => {
    cancelEditing();
    setSelectedIds(new Set());
    setIsExiting(true);
    try {
      let saved = false;
      try {
        await sceneIO.flushSave();
        saved = true;
      } catch (error) {
        showNotice(error instanceof Error ? error.message : '最新變更尚未儲存到伺服器。', true);
        if (!window.confirm('最新變更尚未儲存到伺服器。仍要離開嗎？離開後這些變更會遺失。')) return;
      }
      if (saved && sceneId && sceneIO.shouldRefreshThumbnail()) {
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const thumbnail = captureThumbnail();
        if (thumbnail) {
          try { await scenesApi.update(sceneId, { thumbnail }); }
          catch (error) { console.warn('無法儲存場景縮圖：', error); }
        }
      }
      setToast(null);
      setSceneId(null);
      setView('scenes');
    } finally {
      setIsExiting(false);
    }
  }, [sceneId, sceneIO.flushSave, sceneIO.shouldRefreshThumbnail, cancelEditing, showNotice]);

  const createDevicePoint = (system: DeviceSystem, existing: BanquetObject[]): BanquetObject => ({
    ...createObjectConfig(ObjectType.DEVICE_POINT), system, color: DEVICE_SYSTEMS[system].color, label: nextDeviceCode(existing, system),
  });

  const beginPlacement = (type: ObjectType) => {
    cancelEditing();
    if (!docked) setPanelOpen(false);
    setSelectedIds(new Set());
    setEditTool('move');
    const object = type === ObjectType.DEVICE_POINT ? createDevicePoint(deviceSystem, objects) : withLightMount(createObjectConfig(type), lightMount);
    if (type === ObjectType.COLUMN || type === ObjectType.WALL) object.customHeight = hall.height;
    setPendingPlacement([object]);
  };

  const placePending = (position: { x: number; y: number; z: number }, rotationY?: number) => {
    if (!pendingPlacement) return;
    const placed = pendingPlacement.map(object => {
      const next = {
        ...object,
        position: { x: object.position.x + position.x, y: object.position.y + position.y, z: object.position.z + position.z },
        rotation: rotationY === undefined ? object.rotation : { ...object.rotation, y: rotationY },
      };
      // A plate set on a table shows that table's number unless it was named already.
      const table = next.type === ObjectType.TABLE_NUMBER && !next.label?.trim() ? findTableUnder(objects, next.position) : null;
      return table && isOnTable(next, table) ? { ...next, label: table.label?.trim() ?? '' } : next;
    });
    setSelectedIds(handleBatchAddObjects(placed));
    // Device points, plates and truss lights are placed in runs (room after room, table after table, fixture after fixture).
    const [single] = placed;
    const again = placed.length !== 1 ? null
      : single.type === ObjectType.DEVICE_POINT ? createDevicePoint(single.system ?? 'other', [...objects, ...placed])
      : single.type === ObjectType.TABLE_NUMBER ? { ...createObjectConfig(ObjectType.TABLE_NUMBER), color: single.color, plateStyle: single.plateStyle }
      : single.mount === 'upright' || single.mount === 'inverted' ? withLightMount({ ...createObjectConfig(single.type), color: single.color }, single.mount)
      : null;
    setPendingPlacement(again && [again]);
  };
  /** Tabletop plates for the given tables that have none yet, numbered with each table's label. */
  const addTableNumbers = (ids: Set<string>) => {
    const plates = objects.filter(object => object.type === ObjectType.TABLE_NUMBER);
    const added = objects.flatMap(table => {
      const top = ids.has(table.id) ? getTableTop(table) : null;
      if (!top || plates.some(plate => isOnTable(plate, table))) return [];
      return [{
        ...createObjectConfig(ObjectType.TABLE_NUMBER, { x: table.position.x, y: table.position.y + top.height, z: table.position.z }),
        rotation: { x: 0, y: table.rotation.y, z: 0 },
        label: table.label?.trim() ?? '',
      }];
    });
    if (added.length) handleBatchAddObjects(added);
    showNotice(added.length ? `已加上 ${added.length} 個桌號牌` : '選取的桌子都已有桌號牌');
  };
  const changePendingDeviceSystem = (system: DeviceSystem) => {
    setDeviceSystem(system);
    setPendingPlacement(pending => pending && [createDevicePoint(system, objects)]);
  };
  const placingDevice = pendingPlacement?.length === 1 && pendingPlacement[0].type === ObjectType.DEVICE_POINT ? pendingPlacement[0] : null;
  const changePendingLightMount = (mount: LightMount) => {
    setLightMount(mount);
    setPendingPlacement(pending => pending && pending.length === 1 ? [withLightMount(pending[0], mount)] : pending);
  };
  const placingLight = pendingPlacement?.length === 1 && TRUSS_MOUNT_TYPES[pendingPlacement[0].type] ? pendingPlacement[0] : null;
  /**
   * Re-mounts a placed light: back on the floor, or onto the nearest truss beam within 2 m horizontally (nearest in 3D
   * wins, so a light under a box truss takes the bottom beam), keeping the side it faces.
   */
  const remountLight = (id: string, mount: LightMount) => {
    const light = objects.find(object => object.id === id);
    if (!light) return;
    const next = withLightMount(light, mount);
    if (mount === 'floor') {
      updateObject(id, { mount: next.mount, rotation: next.rotation, position: { ...light.position, y: 0 } });
      return;
    }
    const facing = { x: Math.sin(light.rotation.y), z: Math.cos(light.rotation.y) };
    let best: TrussMountPose | null = null;
    let bestRange = Infinity;
    for (const beam of objects.flatMap(getTrussBeams)) {
      const pose = trussMountPose(beam, light.position, mount, facing);
      const { x, y, z } = pose.position;
      if (Math.hypot(x - light.position.x, z - light.position.z) > 2) continue;
      const range = Math.hypot(x - light.position.x, y - light.position.y, z - light.position.z);
      if (range < bestRange) { bestRange = range; best = pose; }
    }
    if (!best) {
      showNotice('2 公尺內沒有 truss 橫梁：先把燈移到 truss 旁，或從「新增」直接點在 truss 上', true);
      return;
    }
    updateObject(id, { mount: next.mount, position: best.position, rotation: { ...next.rotation, y: best.rotationY } });
  };

  // Path objects are drawn vertex by vertex; an existing id means "redraw" and keeps every other property.
  useEffect(() => setPathDraft([]), [pendingPlacement]);
  const placingPath = pendingPlacement?.length === 1 && isPathType(pendingPlacement[0].type) ? pendingPlacement[0] : null;
  const commitPath = (points: PathPoint[]) => {
    if (!placingPath || points.length < pathVertexLimits(placingPath.type).min) return;
    const [origin] = points;
    const updates = {
      position: { x: origin.x, y: 0, z: origin.z },
      rotation: { x: 0, y: 0, z: 0 },
      points: points.map(point => ({ x: point.x - origin.x, z: point.z - origin.z })),
    };
    if (objects.some(object => object.id === placingPath.id)) {
      updateObject(placingPath.id, updates);
      setSelectedIds(new Set([placingPath.id]));
    } else {
      setSelectedIds(handleBatchAddObjects([{ ...placingPath, ...updates }]));
    }
    setPendingPlacement(null);
  };
  const commitOutline = (points: PathPoint[]) => {
    if (points.length < MIN_OUTLINE_POINTS) return;
    setHall(previous => withOutline(previous, points));
    setDrawingOutline(false);
    setPathDraft([]);
  };
  const beginOutlineDrawing = () => {
    cancelEditing();
    if (!docked) setPanelOpen(false);
    setSelectedIds(new Set());
    drawing.setIsDrawMode(false);
    setPathDraft([]);
    setDrawingOutline(true);
  };
  const pathDrawing = placingPath ? {
    color: placingPath.color,
    vertices: pathDraft,
    snapStep,
    onAdd: (point: PathPoint) => {
      const next = [...pathDraft, point];
      if (next.length >= pathVertexLimits(placingPath.type).max) commitPath(next);
      else setPathDraft(next);
    },
    onFinish: () => commitPath(pathDraft),
    onUndo: () => setPathDraft(draft => draft.slice(0, -1)),
    onClose: CLOSABLE_PATH_TYPES[placingPath.type] ? () => commitPath([...pathDraft, pathDraft[0]]) : undefined,
  } : drawingOutline ? {
    color: '#0f172a',
    vertices: pathDraft,
    snapStep,
    closed: true,
    onAdd: (point: PathPoint) => setPathDraft(draft => [...draft, point]),
    onFinish: () => commitOutline(pathDraft),
    onUndo: () => setPathDraft(draft => draft.slice(0, -1)),
  } : null;
  const drawingLabel = drawingOutline ? '場地外框' : pendingPlacement ? (pendingPlacement[0].label || getObjectLabel(pendingPlacement[0].type)) : undefined;
  const handleRedrawPath = (object: BanquetObject) => {
    cancelEditing();
    if (!docked) setPanelOpen(false);
    setSelectedIds(new Set());
    setEditTool('move');
    setPendingPlacement([object]);
  };

  const duplicateSelected = () => {
    const copies = duplicateObjects(selectedIds);
    setSelectedIds(new Set(copies.map(object => object.id)));
  };

  const handleBatchAddFromModal = (newObjects: import('./types').BanquetObject[]) => {
    const newIds = handleBatchAddObjects(newObjects);
    setSelectedIds(newIds);
  };

  const handleOpenTrussBuilder = () => {
    cancelEditing();
    setEditingTrussId(null);
    setShowTrussBuilder(true);
    drawing.setIsDrawMode(false);
  };

  const handleEditTrussStructure = (object: BanquetObject) => {
    cancelEditing();
    setEditingTrussId(object.id);
    setShowTrussBuilder(true);
    drawing.setIsDrawMode(false);
  };

  const handleCloseTrussBuilder = () => {
    setShowTrussBuilder(false);
    setEditingTrussId(null);
  };

  const handleSubmitTrussStructure = (config: TrussStructureConfig) => {
    if (editingTrussId) {
      const editedConfig = cloneTrussConfig(config);
      delete editedConfig.groupId;
      editedConfig.quantity = 1;
      updateObject(editingTrussId, {
        trussStructure: editedConfig,
        label: config.title,
      });
      return;
    }

    const quantity = Math.max(1, Math.round(config.quantity || 1));
    const groupId = crypto.randomUUID();
    const dims = getTrussDimensions(config);
    const spacing = Math.max(1, dims.widthCm / 100) + 1;
    const startX = -((quantity - 1) * spacing) / 2;
    const newObjects: BanquetObject[] = Array.from({ length: quantity }, (_, index) => {
      const obj = createObjectConfig(ObjectType.TRUSS_STRUCTURE, {
        x: startX + index * spacing,
        y: 0,
        z: 0,
      });
      obj.label = quantity > 1 ? `${config.title} ${index + 1}` : config.title;
      obj.trussStructure = {
        ...cloneTrussConfig(config),
        groupId,
        quantity,
      };
      obj.trussSchematicColors = false;
      return obj;
    });
    setSelectedIds(new Set());
    setEditTool('move');
    setPendingPlacement(newObjects);
  };

  const deleteSelected = () => {
    deleteByIds(selectedIds);
    setSelectedIds(new Set());
  };

  const handleSetMode = (m: 'EDIT' | 'VIEW') => {
    cancelEditing();
    setMode(m);
    if (m === 'VIEW') {
      setSelectedIds(new Set());
      drawing.setIsDrawMode(false);
    } else {
      setPanelOpen(docked);
    }
  };

  // --- Scene Manager (no scene loaded) ---
  if (!sceneId && view === 'trussStudio') {
    return <TrussStudio onBack={() => setView('home')} />;
  }

  if (!sceneId && view === 'scenes') {
    return (
      <>
        {sceneIO.isLoading && (
          <div role="status" className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 text-slate-800 font-medium">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>載入中…</span>
            </div>
          </div>
        )}
        {loadError && (
          <div role="alert" className="fixed top-4 right-4 left-4 sm:left-auto z-50 bg-white ring-1 ring-red-200 text-red-700 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm">
            <span>{loadError}</span>
            <button onClick={() => setLoadError(null)} aria-label="關閉" className="ui-icon-btn text-red-600">✕</button>
          </div>
        )}
        <SceneManager
          onLoad={handleLoadScene}
          onNew={handleNewScene}
          onBackHome={() => setView('home')}
        />
      </>
    );
  }

  if (!sceneId) {
    return (
      <>
        <HomeMenu
          onOpenScenes={() => setView('scenes')}
          onOpenTrussStudio={() => setView('trussStudio')}
          onOpenScene={handleLoadScene}
        />
        {sceneIO.isLoading && <div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl bg-white px-6 py-4 text-sm text-slate-900 shadow-xl"><span className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />載入中…</div>
        </div>}
        {loadError && <div role="alert" className="fixed top-4 right-4 left-4 sm:left-auto z-50 flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-red-700 shadow-lg ring-1 ring-red-200"><span>{loadError}</span><button className="ui-icon-btn text-red-600" aria-label="關閉" onClick={() => setLoadError(null)}>✕</button></div>}
      </>
    );
  }

  // --- Main Editor ---
  return (
    <div className="flex flex-col h-dvh w-screen bg-slate-100 overflow-hidden">
      {/* Loading / Exiting overlay */}
      {(sceneIO.isLoading || isExiting) && (
        <div role="status" className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 text-slate-800 font-medium">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>{isExiting ? '儲存中…' : '載入中…'}</span>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={sceneIO.fileInputRef}
        onChange={sceneIO.handleFileChange}
        accept=".json"
        className="hidden"
      />

      {showBatchModal && (
        <AdvancedAddModal onClose={() => setShowBatchModal(false)} onAddObjects={handleBatchAddFromModal} hall={hall} />
      )}

      {showTrussBuilder && (
        <TrussBuilderModal
          initialConfig={editingTrussId ? objects.find(obj => obj.id === editingTrussId)?.trussStructure : undefined}
          onClose={handleCloseTrussBuilder}
          onSubmit={handleSubmitTrussStructure}
          submitLabel={editingTrussId ? '更新結構' : '下一步：放置到場景'}
          lockQuantity={editingTrussId !== null}
        />
      )}

      {showTrussSheet && (
        <TrussSheetModal objects={objects} onClose={() => setShowTrussSheet(false)} />
      )}
      {showFloorPlan && (
        <FloorPlanModal
          hall={hall}
          objects={objects}
          drawings={drawing.drawings}
          sceneName={sceneIO.sceneName}
          onChangePlanInfo={planInfo => setHall(previous => ({ ...previous, planInfo }))}
          onClose={() => setShowFloorPlan(false)}
        />
      )}
      {showShortcutHelp && <ShortcutHelpDialog onClose={() => setShowShortcutHelp(false)} />}

      {/* Top Toolbar */}
      <TopToolbar
        mode={mode}
        sceneName={sceneIO.sceneName}
        tool={editTool}
        setTool={tool => { cancelEditing(); setEditTool(tool); }}
        snapStep={snapStep}
        setSnapStep={setSnapStep}
        saveStatus={sceneIO.saveStatus}
        saveError={sceneIO.saveError}
        onRetrySave={() => sceneIO.flushSave().catch(() => {})}
        onShortcutHelp={() => setShowShortcutHelp(true)}
        onMenuOpenChange={setToolbarMenuOpen}
        setMode={handleSetMode}
        isDrawMode={drawing.isDrawMode}
        setIsDrawMode={active => { cancelEditing(); drawing.setIsDrawMode(active); }}
        drawingColor={drawing.drawingColor}
        setDrawingColor={drawing.setDrawingColor}
        clearDrawings={drawing.clearDrawings}
        setSelectedIds={setSelectedIds}
        handleImportClick={() => { cancelEditing(); sceneIO.handleImportClick(); }}
        exportScene={sceneIO.exportScene}
        setShowBatchModal={active => { if (active) cancelEditing(); setShowBatchModal(active); }}
        undo={() => { if (!cancelEditing()) undo(); }}
        redo={() => { if (!cancelEditing()) redo(); }}
        canUndo={canUndo}
        canRedo={canRedo}
        viewIndex={viewIndex}
        setViewIndex={index => { setViewIndex(index); setViewRequest(request => request + 1); }}
        viewEnvironment={viewEnvironment}
        setViewEnvironment={setViewEnvironment}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        takeScreenshot={sceneIO.takeScreenshot}
        panelOpen={panelOpen}
        setPanelOpen={open => { setPanelOpen(open); if (open && !docked) setAddPanelOpen(false); }}
        addPanelOpen={addPanelOpen}
        setAddPanelOpen={open => { setAddPanelOpen(open); if (open && !docked) setPanelOpen(false); }}
        onBackToList={handleBackToList}
        hasTrussStructures={objects.some(obj => obj.type === ObjectType.TRUSS_STRUCTURE)}
        onOpenTrussSheets={() => setShowTrussSheet(true)}
        onOpenFloorPlan={() => { cancelEditing(); setShowFloorPlan(true); }}
      />
      {toast && <div role={toast.error ? 'alert' : 'status'} className={`fixed top-16 right-4 left-4 sm:left-auto z-[70] flex max-w-lg items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm shadow-lg ring-1 ${toast.error ? 'text-red-700 ring-red-200' : 'text-slate-900 ring-slate-200'}`}>
        <span>{toast.message}</span><button className="ui-icon-btn shrink-0" aria-label="關閉" onClick={() => setToast(null)}>✕</button>
      </div>}
      {sceneIO.saveStatus === 'conflict' && <SceneConflictDialog onExport={sceneIO.exportScene} onReload={sceneIO.resolveConflictReload} onOverwrite={sceneIO.resolveConflictOverwrite} onError={showNotice} />}

      {/* Main Area */}
      <EditorErrorBoundary key={sceneId} onReload={() => handleLoadScene(sceneId, true)} onBack={() => { void handleBackToList(); }}>
      <div className="flex flex-1 min-h-0">
        {/* Left: Add Object Panel (EDIT mode only) */}
        {mode === 'EDIT' && (
          <AddObjectPanel
            isOpen={addPanelOpen}
            setIsOpen={setAddPanelOpen}
            placingType={pendingPlacement?.[0]?.type ?? null}
            onBeginPlacement={beginPlacement}
            setIsDrawMode={drawing.setIsDrawMode}
            onOpenTrussBuilder={handleOpenTrussBuilder}
          />
        )}

        {/* 3D Scene */}
        <div className="flex-1 relative min-w-0 overflow-hidden">
          <SceneCanvas
            mode={mode}
            hall={hall}
            objects={objects}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            viewIndex={viewIndex}
            viewRequest={viewRequest}
            viewEnvironment={viewEnvironment}
            showLabels={showLabels}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            isDrawMode={drawing.isDrawMode}
            drawingColor={drawing.drawingColor}
            drawings={drawing.drawings}
            currentPath={drawing.currentPath}
            startPath={drawing.startPath}
            extendPath={drawing.extendPath}
            finishPath={drawing.finishPath}
            tool={editTool}
            snapStep={snapStep}
            sessionRef={editorSessionRef}
            pendingPlacement={pendingPlacement}
            onPlace={placePending}
            onCancel={cancelEditing}
            pathDrawing={pathDrawing}
            handleBatchUpdate={handleBatchUpdate}
            objectRefs={objectRefs}
          />
          {mode === 'EDIT' && !drawing.isDrawMode && (
              <EditorControls
                tool={editTool} setTool={tool => { cancelEditing(); setEditTool(tool); }}
                snapStep={snapStep} setSnapStep={setSnapStep}
                selectedCount={selectedIds.size}
                isPlacing={pendingPlacement !== null || drawingOutline}
                placementLabel={drawingLabel ?? ''}
                onCancel={cancelEditing} busy={isDragging}
                path={pathDrawing ? { vertices: pathDraft.length, min: placingPath ? pathVertexLimits(placingPath.type).min : MIN_OUTLINE_POINTS, closed: drawingOutline, loop: !!placingPath && !!CLOSABLE_PATH_TYPES[placingPath.type], onFinish: pathDrawing.onFinish, onUndo: pathDrawing.onUndo } : undefined}
                deviceSystem={placingDevice ? { value: placingDevice.system ?? 'other', onChange: changePendingDeviceSystem } : undefined}
                lightMount={placingLight ? { value: placingLight.mount ?? 'floor', onChange: changePendingLightMount } : undefined}
                placementHint={pendingPlacement?.[0]?.type === ObjectType.TABLE_NUMBER ? (pendingPlacement[0].plateStyle === 'floor' ? '點擊地面放置；連續放置，Esc 結束' : '點擊桌面放置，自動帶入桌號；連續放置，Esc 結束')
                  : placingLight?.mount ? '點擊 truss 橫梁放置；連續放置，Esc 結束' : undefined}
                onDuplicate={duplicateSelected} onDelete={deleteSelected}
              />
          )}
          {mode === 'VIEW' && !drawing.isDrawMode && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-max lg:hidden bg-slate-900/90 backdrop-blur-sm ring-1 ring-white/10 rounded-xl shadow-lg p-2">
            <ViewControls viewIndex={viewIndex} setViewIndex={index => { setViewIndex(index); setViewRequest(request => request + 1); }} viewEnvironment={viewEnvironment} setViewEnvironment={setViewEnvironment} showLabels={showLabels} setShowLabels={setShowLabels} takeScreenshot={sceneIO.takeScreenshot} />
          </div>}
          {drawing.isDrawMode && <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-max xl:hidden rounded-xl shadow-lg ring-1 p-2 ${mode === 'VIEW' ? 'bg-slate-900/90 backdrop-blur-sm ring-white/10' : 'bg-white ring-slate-200'}`}>
            <DrawingControls drawingColor={drawing.drawingColor} setDrawingColor={drawing.setDrawingColor} clearDrawings={drawing.clearDrawings} dark={mode === 'VIEW'} />
          </div>}
        </div>

        {/* Right Sidebar */}
        <Sidebar
          mode={mode}
          hall={hall}
          setHall={setHall}
          objects={objects}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          deleteObject={deleteObject}
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
          onDrawOutline={beginOutlineDrawing}
        >
          <PropertiesPanel
            selectedIds={selectedIds}
            objects={objects}
            updateObject={updateObject}
            deleteSelected={deleteSelected}
            handleBulkPropertyUpdate={handleBulkPropertyUpdate}
            handleAddStair={handleAddStair}
            handleRemoveStair={handleRemoveStair}
            handleUpdateStair={handleUpdateStair}
            onEditTrussStructure={handleEditTrussStructure}
            onRedrawPath={handleRedrawPath}
            onAddTableNumbers={addTableNumbers}
            onRemountLight={remountLight}
          />
        </Sidebar>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        mode={mode}
        isDrawMode={drawing.isDrawMode}
        selectedIds={selectedIds}
        objects={objects}
        placementLabel={drawingLabel}
      />
      </EditorErrorBoundary>
    </div>
  );
}
