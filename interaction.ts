export type EditTool = 'move' | 'rotate' | 'height';

export interface EditorSession {
  cancel: () => boolean;
}
