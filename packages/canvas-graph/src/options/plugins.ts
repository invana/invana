import { IElementEvent, NodeData, EdgeData, ComboData } from '@antv/g6';


export const MINIMAP_PLUGIN = {
  type: 'minimap',
  size: [240, 160],
  className: 'minimap',
  position: 'bottom-left',
  // position: 'bottomLeft',
  // delegateStyle: {
  //   fill: 'rgba(0, 0, 0, 0.1)',
  //   stroke: '#5B8FF9',
  // },
}

export const HISTORY_PLUGIN = {
  type: 'history',
  key: 'history',
}

export const GRID_PLUGIN = {
  type: 'grid-line', key: 'grid-line', follow: true, lineStyle: {
    stroke: '#222222', // Set grid line color
    lineWidth: 1, // Set line width
  },
}

export const TOOLTIP_PLUGIN = {
  type: 'tooltip',
  enable: true,
  enterable: true,
  trigger: 'hover',

  getContent: (e: IElementEvent, items: NodeData | EdgeData | ComboData[]): Promise<HTMLElement | string> => {
    // console.log("TOOLTIP_PLUGIN e", e, items);
    if (!items || items.length === 0) return Promise.resolve("");
    const node = Array.isArray(items) ? items[0] as NodeData : items as NodeData;
    // console.log("TOOLTIP_PLUGIN node", node);
    const content = document.createElement('div');
    content.innerHTML = `
        <div class="max-w-xs p-4 bg-white shadow-md rounded-md border border-gray-200 w-[280px]">
          <div class="space-y-2">
            <h3 class="text-lg font-semibold text-gray-800">${node.label}</h3>
            <p><strong>ID:</strong> ${node.id}</p>
            <p><strong>Label:</strong> ${node.type}</p>
          </div>
        </div>

    `;
    return Promise.resolve(content);
  }

}