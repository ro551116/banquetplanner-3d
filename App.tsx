import React, { useState, useRef } from 'react';
import { Menu } from 'lucide-react';
import * as THREE from 'three';
import { ObjectType } from './types';
import { INITIAL_HALL } from './constants';
import { useObjects } from './hooks/useObjects';
import { useDrawing } from './hooks/useDrawing';
import { useSceneIO } from './hooks/useSceneIO';
import { useKeyboard } from './hooks/useKeyboard';
import { Sidebar } from './components/Sidebar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { AdvancedAddModal } from './components/AdvancedAddModal';
import { ViewToolbar } from './components/ViewToolbar';
import { SceneCanvas } from './components/SceneCanvas';

export default function App() {
  const [mode, setMode] = useState<'EDIT' | 'VIEW'>('EDIT');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hall, setHall] = useState(INITIAL_HALL);
  const [isDragging, setIsDragging] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);
  const [viewEnvironment, setViewEnvironment] = useState<'day' | 'night'>('day');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [draggedType, setDraggedType] = useState<ObjectType | null>(null);

  const objectRefs = useRef<Record<string, THREE.Group | null>>({});

  // --- Hooks ---
  const {
    objects, setObjects, addObject, updateObject, deleteObject,
    deleteByIds, handleBatchUpdate, handleBulkPropertyUpdate,
    handleBatchAddObjects, duplicateObjects, handleAddStair, handleRemoveStair,
    handleUpdateStair, undo, redo, canUndo, canRedo
  } = useObjects();

  const drawing = useDrawing();

  const sceneIO = useSceneIO({
    hall, objects, drawings: drawing.drawings,
    setHall, setObjects, setDrawings: drawing.setDrawings,
    setSelectedIds, setIsDrawMode: drawing.setIsDrawMode, setMode
  });

  useKeyboard({
    mode, selectedIds, objects,
    deleteByIds, handleBatchUpdate,
    setSelectedIds, setIsDrawMode: drawing.setIsDrawMode,
    undo, redo, duplicateObjects
  });

  // --- Handlers ---
  const handleAddObjectFromSidebar = (type: ObjectType, pos?: { x: number; y: number; z: number }) => {
    const newObj = addObject(type, pos);
    setSelectedIds(new Set([newObj.id]));
    drawing.setIsDrawMode(false);
    if (window.innerWidth < 768) setMobileSidebarOpen(false);
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


  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden relative">

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

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && mode === 'EDIT' && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        mode={mode}
        hall={hall}
        setHall={setHall}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
        isDrawMode={drawing.isDrawMode}
        setIsDrawMode={drawing.setIsDrawMode}
        drawingColor={drawing.drawingColor}
        setDrawingColor={drawing.setDrawingColor}
        clearDrawings={drawing.clearDrawings}
        setSelectedIds={setSelectedIds}
        setShowBatchModal={setShowBatchModal}
        addObject={handleAddObjectFromSidebar}
        setDraggedType={setDraggedType}
        handleImportClick={sceneIO.handleImportClick}
        exportScene={sceneIO.exportScene}
        objects={objects}
        selectedIds={selectedIds}
        deleteObject={deleteObject}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
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

      {/* Main Viewport */}
      <div className="flex-1 relative bg-slate-100 h-full w-full">
        {/* Header Controls */}
        <div className="absolute top-5 left-5 right-5 z-10 flex items-start justify-between md:justify-start gap-4 pointer-events-none">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className={`md:hidden pointer-events-auto bg-white/90 p-2 rounded-full shadow-sm border border-slate-200 text-slate-600 ${mode === 'EDIT' ? 'block' : 'hidden'}`}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="pointer-events-auto bg-white/90 backdrop-blur-sm p-1 rounded-full shadow-sm border border-slate-200 flex">
            <button
              onClick={() => setMode('EDIT')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'EDIT' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              編輯模式 (Edit)
            </button>
            <button
              onClick={() => { setMode('VIEW'); setSelectedIds(new Set()); drawing.setIsDrawMode(false); setMobileSidebarOpen(false); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'VIEW' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              展示模式 (View)
            </button>
          </div>
        </div>

        {/* View Mode Toolbar */}
        {mode === 'VIEW' && (
          <ViewToolbar
            viewIndex={viewIndex}
            setViewIndex={setViewIndex}
            viewEnvironment={viewEnvironment}
            setViewEnvironment={setViewEnvironment}
            takeScreenshot={sceneIO.takeScreenshot}
          />
        )}

        {/* 3D Scene */}
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
    </div>
  );
}
