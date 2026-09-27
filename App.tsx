import React, { useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { BanquetObject, ObjectType, TrussStructureConfig } from './types';
import { createObjectConfig, INITIAL_HALL } from './constants';
import { cloneTrussConfig, getTrussDimensions } from './trussConfig';
import { useObjects } from './hooks/useObjects';
import { useDrawing } from './hooks/useDrawing';
import { useSceneIO } from './hooks/useSceneIO';
import { useKeyboard } from './hooks/useKeyboard';
import { TopToolbar } from './components/TopToolbar';
import { Sidebar } from './components/Sidebar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { AdvancedAddModal } from './components/AdvancedAddModal';
import StatusBar from './components/StatusBar';
import { SceneCanvas } from './components/SceneCanvas';
import { SceneManager } from './components/SceneManager';
import { HomeMenu } from './components/HomeMenu';
import { AddObjectPanel, getObjectLabel } from './components/AddObjectPanel';
import { TrussBuilderModal } from './components/TrussBuilderModal';
import { TrussSheetModal } from './components/TrussSheetModal';
import { TrussStudio } from './components/TrussStudio';
import { EditorControls } from './components/EditorControls';
import { EditTool, EditorSession } from './interaction';

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
  const [panelOpen, setPanelOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [addPanelOpen, setAddPanelOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [showTrussBuilder, setShowTrussBuilder] = useState(false);
  const [editingTrussId, setEditingTrussId] = useState<string | null>(null);
  const [showTrussSheet, setShowTrussSheet] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const objectRefs = useRef<Record<string, THREE.Group | null>>({});

  const {
    objects, setObjects, resetObjects, updateObject, deleteObject,
    deleteByIds, handleBatchUpdate, handleBulkPropertyUpdate,
    handleBatchAddObjects, duplicateObjects, handleAddStair, handleRemoveStair,
    handleUpdateStair, undo, redo, canUndo, canRedo
  } = useObjects();

  const drawing = useDrawing();

  const cancelEditing = useCallback(() => {
    if (editorSessionRef.current?.cancel()) return true;
    if (pendingPlacement) {
      setPendingPlacement(null);
      return true;
    }
    if (drawing.isDrawMode || drawing.currentPath.length) {
      drawing.cancelPath();
      drawing.setIsDrawMode(false);
      return true;
    }
    return false;
  }, [pendingPlacement, drawing.isDrawMode, drawing.currentPath.length, drawing.cancelPath, drawing.setIsDrawMode]);

  const sceneIO = useSceneIO({
    sceneId, hall, objects, drawings: drawing.drawings,
    setHall, setObjects, resetObjects, setDrawings: drawing.setDrawings,
    setSelectedIds, setIsDrawMode: drawing.setIsDrawMode, setMode
  });

  useKeyboard({
    enabled: sceneId !== null && !showTrussBuilder && !showTrussSheet && !showBatchModal,
    mode, selectedIds, objects,
    deleteByIds, handleBatchUpdate,
    setSelectedIds, setIsDrawMode: drawing.setIsDrawMode,
    undo, redo, duplicateObjects,
    onCancel: cancelEditing, busy: isDragging || pendingPlacement !== null,
    tool: editTool, setTool: tool => { cancelEditing(); setEditTool(tool); }, snapStep
  });

  const handleLoadScene = useCallback(async (id: string) => {
    setLoadError(null);
    const ok = await sceneIO.loadScene(id);
    if (ok) {
      setView('scenes');
      setSceneId(id);
    } else {
      setLoadError('無法載入該場景，請稍後再試。');
    }
  }, [sceneIO.loadScene]);

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
    try {
      setIsExiting(true);
      await sceneIO.flushSave();
      setSceneId(null);
      setView('scenes');
    } catch (err: unknown) {
      console.error('Failed to flush save before exiting:', err);
    } finally {
      setIsExiting(false);
    }
  }, [sceneIO.flushSave, cancelEditing]);

  const beginPlacement = (type: ObjectType) => {
    cancelEditing();
    if (window.innerWidth < 768) setPanelOpen(false);
    setSelectedIds(new Set());
    setEditTool('move');
    setPendingPlacement([createObjectConfig(type)]);
  };

  const placePending = (position: { x: number; y: number; z: number }) => {
    if (!pendingPlacement) return;
    const placed = pendingPlacement.map(object => ({
      ...object,
      position: { x: object.position.x + position.x, y: object.position.y + position.y, z: object.position.z + position.z },
    }));
    setSelectedIds(handleBatchAddObjects(placed));
    setPendingPlacement(null);
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
      setPanelOpen(window.innerWidth >= 768);
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
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-xs">
            <div className="bg-white px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 text-slate-800 font-medium">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>載入中…</span>
            </div>
          </div>
        )}
        {loadError && (
          <div role="alert" className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <span>{loadError}</span>
            <button onClick={() => setLoadError(null)} className="text-red-700 hover:text-red-900 font-bold cursor-pointer">✕</button>
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
      <HomeMenu
        onOpenScenes={() => setView('scenes')}
        onOpenTrussStudio={() => setView('trussStudio')}
      />
    );
  }

  // --- Main Editor ---
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">
      {/* Loading / Exiting overlay */}
      {(sceneIO.isLoading || isExiting) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-xs">
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

      {/* Top Toolbar */}
      <TopToolbar
        mode={mode}
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
        setPanelOpen={open => { setPanelOpen(open); if (open && window.innerWidth < 768) setAddPanelOpen(false); }}
        addPanelOpen={addPanelOpen}
        setAddPanelOpen={open => { setAddPanelOpen(open); if (open && window.innerWidth < 768) setPanelOpen(false); }}
        onBackToList={handleBackToList}
        hasTrussStructures={objects.some(obj => obj.type === ObjectType.TRUSS_STRUCTURE)}
        onOpenTrussSheets={() => setShowTrussSheet(true)}
      />
      {/* Save Status Indicator */}
      {sceneId && (
        <div
          aria-live="polite"
          className={`h-7 flex-shrink-0 px-4 py-1 text-xs flex items-center justify-between border-b z-20 ${
            sceneIO.saveStatus === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : sceneIO.saveStatus === 'saving'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : sceneIO.saveStatus === 'dirty'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {sceneIO.saveStatus === 'idle' && '已載入'}
              {sceneIO.saveStatus === 'dirty' && '尚未儲存'}
              {sceneIO.saveStatus === 'saving' && '儲存中…'}
              {sceneIO.saveStatus === 'saved' && '已儲存'}
              {sceneIO.saveStatus === 'error' && '儲存失敗'}
            </span>
            {sceneIO.saveStatus === 'error' && sceneIO.saveError && (
              <span className="text-red-500 text-[11px]">({sceneIO.saveError})</span>
            )}
          </div>
          {sceneIO.saveStatus === 'error' && (
            <button
              type="button"
              onClick={() => sceneIO.flushSave().catch(() => {})}
              className="text-xs px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 rounded font-semibold transition-colors cursor-pointer"
            >
              重試儲存
            </button>
          )}
        </div>
      )}

      {/* Main Area */}
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
            handleBatchUpdate={handleBatchUpdate}
            objectRefs={objectRefs}
          />
          {mode === 'EDIT' && !drawing.isDrawMode && (
            <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none">
              <EditorControls
                tool={editTool} setTool={tool => { cancelEditing(); setEditTool(tool); }}
                snapStep={snapStep} setSnapStep={setSnapStep}
                selectedCount={selectedIds.size}
                isPlacing={pendingPlacement !== null}
                placementLabel={pendingPlacement ? (pendingPlacement[0].label || getObjectLabel(pendingPlacement[0].type)) : ''}
                onCancel={cancelEditing} busy={isDragging}
                onDuplicate={duplicateSelected} onDelete={deleteSelected}
              />
            </div>
          )}
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
          />
        </Sidebar>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        mode={mode}
        isDrawMode={drawing.isDrawMode}
        selectedIds={selectedIds}
        objects={objects}
      />
    </div>
  );
}
