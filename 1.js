createReorderInteraction({
    attachLayer: xAxisLayer,
    pickingLayer: cellLayer,
    copyLayer: copyLayer,
    scales: { scaleX, scaleY },
    names: names,
    direction: 'x',
    onUpdate: ({ reorderedNames, x, y }) => {
        renderMatrix(cellLayer, xAxisLayer, yAxisLayer, matrixData, reorderedNames, x, y, color);
    }
});