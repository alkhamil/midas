// Fills (pure). The fills a layer paints, in the order stored: the first one is the top. A layer with no `fills` list reads its
// legacy fields (`fill`, `fillType`, `fill2`, `fillImage`). The canvas and the DOM preview both read fills from here.
export function getFills(n) {
    if (Array.isArray(n.fills))
        return n.fills;
    if (n.type === 'image')
        return [{ type: 'image', image: n.assetId, mode: 'fill', scale: 1, opacity: 1, visible: true }];
    if (!n.fill || n.fill === 'none')
        return [];
    if (n.fillType === 'image' && n.fillImage)
        return [{ type: 'image', image: n.fillImage, mode: n.fillMode || 'fill', scale: n.fillScale || 1, opacity: n.fillOpacity ?? 1, visible: true }];
    if (n.fillType === 'linear')
        return [{ type: 'linear', color: n.fill, color2: n.fill2 || '#ffffff', angle: n.gradientAngle ?? 90, opacity: n.fillOpacity ?? 1, visible: true }];
    return [{ type: 'solid', color: n.fill, opacity: n.fillOpacity ?? 1, visible: true }];
}
