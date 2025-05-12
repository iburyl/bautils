function drawFoundPeaks(firstFrame, lastFrame, firstBin, lastBin, specCanvasWindow, foundPeaks, ctx) {
    let numFrames = lastFrame - firstFrame;
    let numBins   = lastBin - firstBin;

    const framesPerPixel = numFrames / specCanvasWindow.width;
    const binsPerPixel = numBins / specCanvasWindow.height;

    const bar_color = magnitudeToRGBDark(0.9, 0, 1);
    const box_color = magnitudeToRGBDark(0.9, 0, 1, 0.3);
    const pth_color = 'rgb( 255 0 255 )';
    const pth_color_2 = 'rgb( 0 128 255 )';

    for(let i=0; i<foundPeaks.length; i++) {
        let x = Math.floor(foundPeaks[i].box.leftFrame / framesPerPixel);
        let delta = Math.max(Math.round((foundPeaks[i].box.rightFrame - foundPeaks[i].box.leftFrame) / framesPerPixel), 1);

        let y1 = Math.floor((foundPeaks[i].box.maxBin - firstBin) / binsPerPixel);
        let y2 = Math.floor((foundPeaks[i].box.minBin - firstBin) / binsPerPixel);


        // Draw peak box
        ctx.fillStyle = box_color;
        ctx.fillRect(specCanvasWindow.x + x, specCanvasWindow.y - y1, delta, y1-y2);

        // Draw peak bar
        ctx.fillStyle = bar_color;
        ctx.fillRect(specCanvasWindow.x + x, specCanvasWindow.y - specCanvasWindow.height + 5, delta, 3);

        // Draw peak path
        ctx.fillStyle = pth_color;
        if (foundPeaks[i].box.rightPath) {
            for(let j=0; j<foundPeaks[i].box.rightPath.length; j++) {
                let x = Math.floor(foundPeaks[i].box.rightPath[j].frame / framesPerPixel);
                let y = Math.floor((foundPeaks[i].box.rightPath[j].bin - firstBin) / binsPerPixel);
                ctx.fillRect(specCanvasWindow.x + x, specCanvasWindow.y - y, 2, 2);
            }
        }
        ctx.fillStyle = pth_color_2;
        if (foundPeaks[i].box.leftPath) {
            for(let j=0; j<foundPeaks[i].box.leftPath.length; j++) {
                let x = Math.floor(foundPeaks[i].box.leftPath[j].frame / framesPerPixel);
                let y = Math.floor((foundPeaks[i].box.leftPath[j].bin - firstBin) / binsPerPixel);
                ctx.fillRect(specCanvasWindow.x + x, specCanvasWindow.y - y, 2, 2);
            }
        }
    }
}

function drawPeaksOverlay(peaks, signalWindowMapping, specCanvasWindow, mainImage, ctx) {
    ctx.putImageData(mainImage, 0, 0);

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    drawFoundPeaks(signalWindowMapping.startFrame, signalWindowMapping.stopFrame, signalWindowMapping.firstBin, signalWindowMapping.lastBin, specCanvasWindow, peaks, ctx);

    return {overlayImage: ctx.getImageData(0, 0, width, height)};
}
