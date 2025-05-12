function drawFoundPeaks(firstFrame, lastFrame, firstBin, lastBin, specCanvasWindow, foundPeaks, ctx) {
    let numFrames = lastFrame - firstFrame;
    let numBins   = lastBin - firstBin;

    const framesPerPixel = numFrames / specCanvasWindow.width;
    const binsPerPixel = numBins / specCanvasWindow.height;

    const bar_color = magnitudeToRGBDark(0.9, 0, 1);
    const box_color = magnitudeToRGBDark(0.9, 0, 1, 0.3);
    const pth_color = 'rgb( 255 0 255 )';

    for(let i=0; i<foundPeaks.length; i++) {
        let x = Math.floor(foundPeaks[i].start / framesPerPixel);
        let delta = Math.max(Math.round((foundPeaks[i].stop - foundPeaks[i].start) / framesPerPixel), 1);

        let y1 = Math.floor((foundPeaks[i].maxFreq_10 - firstBin) / binsPerPixel);
        let y2 = Math.floor((foundPeaks[i].minFreq_10 - firstBin) / binsPerPixel);

        ctx.fillStyle = box_color;
        ctx.fillRect(specCanvasWindow.x + x, specCanvasWindow.y - y1, delta, y1-y2);

        ctx.fillStyle = bar_color;
        ctx.fillRect(specCanvasWindow.x + x, specCanvasWindow.y - specCanvasWindow.height + 5, delta, 3);

        ctx.fillStyle = pth_color;

        for(let j=0; j<foundPeaks[i].rightPath.length; j++) {
            let x = Math.floor(foundPeaks[i].rightPath[j].frame / framesPerPixel);
            let y = Math.floor((foundPeaks[i].rightPath[j].bin - firstBin) / binsPerPixel);

            ctx.fillRect(specCanvasWindow.x + x, specCanvasWindow.y - y, 3, 3);
        }
    }
}

function drawPeaksOverlay(peaks, signalWindowMapping, specCanvasWindow, mainImage, ctx) {
    ctx.putImageData(mainImage, 0, 0);

    drawFoundPeaks(signalWindowMapping.startFrame, signalWindowMapping.stopFrame, signalWindowMapping.firstBin, signalWindowMapping.lastBin, specCanvasWindow, peaks, ctx);
}
