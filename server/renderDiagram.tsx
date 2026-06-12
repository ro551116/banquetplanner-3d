import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrussDiagram } from '../components/TrussDiagram';
import type { TrussStructureConfig } from '../types';

export function renderTrussDiagramSvg(config: TrussStructureConfig): string {
  const markup = renderToStaticMarkup(
    <TrussDiagram config={config} svgId="truss-diagram" />
  );

  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}
