import React, { useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { ObjectType } from './types';
import { INITIAL_HALL } from './constants';
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
import { AddObjectPanel } from './components/AddObjectPanel';

export default function App() {
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [mode, setMode] = useState<'EDIT' | 'VIEW'>('EDIT');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hall, setHall] = useState(INITIAL_HALL);
  const [isDragging, setIsDragging] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);
  const [viewEnvironment, setViewEnvironment] = useState<'day' | 'night'>('day');
  const [draggedType, setDraggedType] = useState<ObjectType | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [addPanelOpen, setAddPanelOpen] = useState(true);

  const objectRefs = useRef<Record<string, THREE.Group | null>>({});

  const {
    objects, setObjects, addObject, updateObject, deleteObject,
    deleteByIds, handleBatchUpdate, handleBulkPropertyUpdate,
    handleBatchAddObjects, duplicateObjects, handleAddStair, handleRemoveStair,
    handleUpdateStair, undo, redo, canUndo, canRedo
  } = useObjects();

  const drawing = useDrawing();

  const sceneIO = useSceneIO({
    sceneId, hall, objects, drawings: drawing.drawings,
    setHall, setObjects, setDrawings: drawing.setDrawings,
    setSelectedIds, setIsDrawMode: drawing.setIsDrawMode, setMode
  });

  useKeyboard({
    mode, selectedIds, objects,
    deleteByIds, handleBatchUpdate,
    setSelectedIds, setIsDrawMode: drawing.setIsDrawMode,
    undo, redo, duplicateObjects
  });

  const handleLoadScene = useCallback(async (id: string) => {
    setSceneId(id);
    await sceneIO.loadScene(id);
  }, [sceneIO.loadScene]);

  const handleNewScene = useCallback(async (id: string) => {
    setSceneId(id);
    await sceneIO.loadScene(id);
  }, [sceneIO.loadScene]);

  const handleBackToList = useCallback(() => {
    setSceneId(null);
  }, []);

  const handleAddObjectFromSidebar = (type: ObjectType, pos?: { x: number; y: number; z: number }) => {
    const newObj = addObject(type, pos);
    setSelectedIds(new Set([newObj.id]));
    drawing.setIsDrawMode(false);
    return newObj;
  };

  const handleBatchAddFromModal = (newObjects: import('./types').BanquetObject[]) => {
    const newIds = handleBatchAddObjects(newObjects);
    setSelectedIds(newIds);
  };

  const deleteSelected = () => {
    deleteByIds(selectedIds);
    setSelectedIds(new Set());
  };

  const handleSetMode = (m: 'EDIT' | 'VIEW') => {
    setMode(m);
    if (m === 'VIEW') {
      setSelectedIds(new Set());
      drawing.setIsDrawMode(false);
    }
  };

  // --- Scene Manager (no scene loaded) ---
  if (!sceneId) {
    return <SceneManager onLoad={handleLoadScene} onNew={handleNewScene} />;
  }

  // --- Main Editor ---
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">

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

      {/* Top Toolbar */}
      <TopToolbar
        mode={mode}
        setMode={handleSetMode}
        isDrawMode={drawing.isDrawMode}
        setIsDrawMode={drawing.setIsDrawMode}
        drawingColor={drawing.drawingColor}
        setDrawingColor={drawing.setDrawingColor}
        clearDrawings={drawing.clearDrawings}
        setSelectedIds={setSelectedIds}
        handleImportClick={sceneIO.handleImportClick}
        exportScene={sceneIO.exportScene}
        setShowBatchModal={setShowBatchModal}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        viewIndex={viewIndex}
        setViewIndex={setViewIndex}
        viewEnvironment={viewEnvironment}
        setViewEnvironment={setViewEnvironment}
        takeScreenshot={sceneIO.takeScreenshot}
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
        addPanelOpen={addPanelOpen}
        setAddPanelOpen={setAddPanelOpen}
        onBackToList={handleBackToList}
      />

      {/* Main Area */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Add Object Panel (EDIT mode only) */}
        {mode === 'EDIT' && (
          <AddObjectPanel
            isOpen={addPanelOpen}
            setIsOpen={setAddPanelOpen}
            addObject={(type) => handleAddObjectFromSidebar(type)}
            setDraggedType={setDraggedType}
            setIsDrawMode={drawing.setIsDrawMode}
          />
        )}

        {/* 3D Scene */}
        <div className="flex-1 relative">
          <SceneCanvas
            mode={mode}
            hall={hall}
            objects={objects}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            viewIndex={viewIndex}
            viewEnvironment={viewEnvironment}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            isDrawMode={drawing.isDrawMode}
            drawingColor={drawing.drawingColor}
            drawings={drawing.drawings}
            currentPath={drawing.currentPath}
            startPath={drawing.startPath}
            extendPath={drawing.extendPath}
            finishPath={drawing.finishPath}
            draggedType={draggedType}
            setDraggedType={setDraggedType}
            addObject={handleAddObjectFromSidebar}
            handleBatchUpdate={handleBatchUpdate}
            objectRefs={objectRefs}
          />
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
