import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { BanquetObject, HallConfig } from '../types';
import { buildHallPreset, HALL_STRUCTURE_TYPES, hallPresetTitle } from '../hallPresets';
import { hallPresetsApi, type HallPresetMeta, type LoadedHallPreset } from '../services/hallPresetsApi';

/** Preset options grouped by venue (地點); the server lists presets without a venue first. */
export function HallPresetOptions({ presets }: { presets: HallPresetMeta[] }) {
  const groups = new Map<string, HallPresetMeta[]>();
  for (const preset of presets) groups.set(preset.venue ?? '', [...(groups.get(preset.venue ?? '') ?? []), preset]);
  return <>{[...groups].map(([venue, items]) => {
    const options = items.map(item => <option key={item.id} value={item.id}>{item.name}</option>);
    return venue ? <optgroup key={venue} label={venue}>{options}</optgroup> : <React.Fragment key="">{options}</React.Fragment>;
  })}</>;
}

interface HallPresetPanelProps {
  hall: HallConfig;
  objects: BanquetObject[];
  onApply: (preset: LoadedHallPreset) => void;
  onNotice: (message: string, error?: boolean) => void;
}

interface PresetForm {
  venue: string;
  name: string;
  includeStructures: boolean;
}

/** 場地設定 → 廳房: saves the current hall as a venue preset, or applies / deletes a saved one. */
export function HallPresetPanel({ hall, objects, onApply, onNotice }: HallPresetPanelProps) {
  const id = useId();
  const [presets, setPresets] = useState<HallPresetMeta[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<PresetForm | null>(null);
  const [busy, setBusy] = useState(false);
  // A ref, not state: two clicks in the same frame both see `busy === false` before React re-renders.
  const busyRef = useRef(false);
  const structureCount = objects.filter(object => HALL_STRUCTURE_TYPES[object.type]).length;
  const selected = presets?.find(preset => preset.id === selectedId);

  const refresh = useCallback(async (select?: string) => {
    setPresets(await hallPresetsApi.list());
    if (select !== undefined) setSelectedId(select);
  }, []);
  useEffect(() => {
    refresh().catch((error: unknown) => {
      setPresets([]);
      onNotice(`無法載入廳房：${error instanceof Error ? error.message : String(error)}`, true);
    });
  }, [refresh, onNotice]);

  const run = async (failure: string, task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      onNotice(`${failure}：${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const apply = () => run('無法套用廳房', async () => {
    if (!selected) return;
    const structures = selected.structures ? `目前 ${structureCount} 個 → 廳房的 ${selected.structures} 個` : `廳房沒有存，保留目前的 ${structureCount} 個`;
    const question = `套用廳房「${hallPresetTitle(selected)}」？\n・場地尺寸、外框與材質換成廳房設定（無法復原）\n・門／柱子／隔間牆：${structures}\n・其他物件不變`;
    if (!window.confirm(question)) return;
    const preset = await hallPresetsApi.load(selected.id);
    onApply(preset);
    onNotice(`已套用廳房「${preset.title}」`);
  });

  const remove = () => run('無法刪除廳房', async () => {
    if (!selected) return;
    const title = hallPresetTitle(selected);
    if (!window.confirm(`刪除廳房「${title}」？用它建立或套用過的場景不受影響。`)) return;
    await hallPresetsApi.delete(selected.id);
    await refresh('');
    onNotice(`已刪除廳房「${title}」`);
  });

  const save = () => run('無法儲存廳房', async () => {
    const name = form?.name.trim();
    if (!form || !name) return;
    const venue = form.venue.trim() || null;
    const title = hallPresetTitle({ name, venue });
    const existing = presets?.find(preset => preset.name === name && preset.venue === venue);
    if (existing && !window.confirm(`廳房「${title}」已存在，要用目前的場地覆蓋嗎？`)) return;
    const payload = { name, venue, ...buildHallPreset(hall, objects, form.includeStructures) };
    const saved = existing ? await hallPresetsApi.update(existing.id, payload) : await hallPresetsApi.create(payload);
    setForm(null);
    await refresh(saved.id);
    onNotice(`已儲存廳房「${title}」`);
  });

  const onFormKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter/Esc that confirm or dismiss an IME candidate must not save a half-typed name.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') void save();
    if (event.key === 'Escape') {
      event.stopPropagation();
      setForm(null);
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="ui-section-title">廳房</h3>
      <div className="flex gap-2">
        <select aria-label="已存的廳房" className="ui-input min-w-0 flex-1 coarse:h-11" value={selectedId} disabled={!presets?.length} onChange={event => setSelectedId(event.target.value)}>
          <option value="">{presets === null ? '載入中…' : presets.length ? '選擇廳房…' : '尚未儲存廳房'}</option>
          {presets && <HallPresetOptions presets={presets} />}
        </select>
        <button type="button" className="ui-btn-secondary shrink-0" disabled={!selected || busy} onClick={apply}>套用</button>
        <button type="button" className="ui-icon-btn shrink-0" aria-label="刪除廳房" title="刪除廳房" disabled={!selected || busy} onClick={remove}><Trash2 className="h-4 w-4" /></button>
      </div>
      {selected && <p className="text-xs tabular-nums text-slate-500">
        {selected.venue && `${selected.venue}・`}{[selected.width, selected.length, selected.height].map(value => +value.toFixed(2)).join(' × ')} m・門／柱子／隔間牆 {selected.structures} 個
      </p>}
      {form ? (
        <div className="space-y-3 rounded-lg p-3 ring-1 ring-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={`${id}-venue`} className="ui-label">地點</label>
              <input id={`${id}-venue`} className="ui-input coarse:h-11 coarse:text-base" value={form.venue} placeholder="例如 芙洛麗"
                onChange={event => { const venue = event.target.value; setForm(previous => previous && { ...previous, venue }); }} onKeyDown={onFormKeyDown} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-name`} className="ui-label">廳名</label>
              <input id={`${id}-name`} className="ui-input coarse:h-11 coarse:text-base" value={form.name} placeholder="例如 3F Ballroom II" autoFocus
                onChange={event => { const name = event.target.value; setForm(previous => previous && { ...previous, name }); }} onKeyDown={onFormKeyDown} />
            </div>
          </div>
          {structureCount > 0 && <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-700 coarse:min-h-11">
            <input type="checkbox" checked={form.includeStructures} className="h-4 w-4 rounded border-slate-300 coarse:h-5 coarse:w-5"
              onChange={event => { const includeStructures = event.target.checked; setForm(previous => previous && { ...previous, includeStructures }); }} />
            包含 {structureCount} 個門／柱子／隔間牆
          </label>}
          <div className="flex gap-2">
            <button type="button" className="ui-btn-primary flex-1" disabled={busy || !form.name.trim()} onClick={save}>{busy ? '儲存中…' : '儲存廳房'}</button>
            <button type="button" className="ui-btn-ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      ) : (
        <button type="button" className="ui-btn-secondary w-full" disabled={busy}
          onClick={() => setForm({ venue: selected?.venue ?? '', name: selected?.name ?? '', includeStructures: true })}>
          儲存目前場地為廳房
        </button>
      )}
    </section>
  );
}
