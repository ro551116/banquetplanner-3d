import { useReducer, useCallback } from 'react';

const MAX_HISTORY = 50;

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

type HistoryAction<T> =
  | { type: 'SET'; valueOrUpdater: T | ((prev: T) => T) }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; next: T };

function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
  switch (action.type) {
    case 'SET': {
      const next = typeof action.valueOrUpdater === 'function'
        ? (action.valueOrUpdater as (prev: T) => T)(state.present)
        : action.valueOrUpdater;
      if (Object.is(next, state.present)) {
        return state;
      }
      return {
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
        present: next,
        future: [],
      };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [...state.future, state.present],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[state.future.length - 1];
      return {
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
        present: next,
        future: state.future.slice(0, -1),
      };
    }
    case 'RESET': {
      return {
        past: [],
        present: action.next,
        future: [],
      };
    }
    default:
      return state;
  }
}

export function useHistory<T>(initial: T) {
  const [history, dispatch] = useReducer(
    historyReducer as React.Reducer<HistoryState<T>, HistoryAction<T>>,
    { past: [], present: initial, future: [] }
  );

  const set = useCallback((valueOrUpdater: T | ((prev: T) => T)) => {
    dispatch({ type: 'SET', valueOrUpdater });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const reset = useCallback((next: T) => {
    dispatch({ type: 'RESET', next });
  }, []);

  return {
    state: history.present,
    set,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
