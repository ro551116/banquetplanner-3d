import React from 'react';

interface EditorErrorBoundaryProps {
  children: React.ReactNode;
  onReload: () => Promise<boolean>;
  onBack: () => void;
}

export class EditorErrorBoundary extends React.Component<EditorErrorBoundaryProps, { error: Error | null; reloading: boolean }> {
  state = { error: null as Error | null, reloading: false };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('編輯器渲染失敗：', error, info); }
  private reload = async () => {
    this.setState({ reloading: true });
    try {
      if (await this.props.onReload()) this.setState({ error: null });
    } finally { this.setState({ reloading: false }); }
  };
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="flex flex-1 items-center justify-center p-4">
      <div role="alert" className="ui-card w-full max-w-lg space-y-4 p-6 shadow-lg">
        <h2 className="text-base font-semibold text-slate-900">編輯器發生錯誤</h2>
        <p className="break-words text-xs text-slate-500">{this.state.error.message}</p>
        <div className="flex flex-wrap gap-2">
          <button className="ui-btn-primary" disabled={this.state.reloading} onClick={() => { void this.reload(); }}>重新載入場景</button>
          <button className="ui-btn-secondary" onClick={this.props.onBack}>返回場景列表</button>
        </div>
      </div>
    </div>;
  }
}
