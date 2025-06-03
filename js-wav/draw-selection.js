"use strict";

function drawMagnitudeBoundary(specData, signalWindowMapping, specCanvasWindow, selectionBox, ctx) {
    const framesPerPixel = (signalWindowMapping.stopFrame - signalWindowMapping.startFrame) / specCanvasWindow.width;
    const binsPerPixel = (signalWindowMapping.lastBin - signalWindowMapping.firstBin) / specCanvasWindow.height;

    // Convert selection box coordinates to spectrogram coordinates
    const startFrame = Math.floor((selectionBox.startX - specCanvasWindow.x) * framesPerPixel + signalWindowMapping.startFrame);
    const stopFrame = Math.floor((selectionBox.stopX - specCanvasWindow.x) * framesPerPixel + signalWindowMapping.startFrame);
    const startBin = Math.floor((specCanvasWindow.y - selectionBox.stopY) * binsPerPixel + signalWindowMapping.firstBin);
    const stopBin = Math.floor((specCanvasWindow.y - selectionBox.startY) * binsPerPixel + signalWindowMapping.firstBin);

    // Find peak magnitude in the selection box
    let peakMagnitude = -Infinity;
    for (let frame = startFrame; frame <= stopFrame; frame++) {
        for (let bin = startBin; bin <= stopBin; bin++) {
            if (specData.data[frame][bin] > peakMagnitude) {
                peakMagnitude = specData.data[frame][bin];
            }
        }
    }

    // Threshold for boundary (-30 dB from peak)
    const threshold = peakMagnitude / 100;

    // Calculate dimensions for the selection box
    const x = Math.floor((startFrame - signalWindowMapping.startFrame) / framesPerPixel);
    const delta = Math.max(Math.round((stopFrame - startFrame) / framesPerPixel), 1);
    const y1 = Math.floor((stopBin - signalWindowMapping.firstBin) / binsPerPixel);
    const y2 = Math.floor((startBin - signalWindowMapping.firstBin) / binsPerPixel);
    const bin_delta = y1 - y2;

    // Draw semitransparent box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(specCanvasWindow.x + x, specCanvasWindow.y - y1, delta, y1-y2);

    // Draw boundary
    ctx.fillStyle = 'rgb(255, 255, 255)';
    const lastBinRow = new Array(delta);
    lastBinRow.fill(false);

    for(let jj = 0; jj < bin_delta; jj++) {
        let wasFlag = false;
        for(let ii = 0; ii < delta; ii++) {
            let flag = false;
            for(let jjj = 0; jjj < binsPerPixel; jjj++) {
                for(let iii = 0; iii < framesPerPixel; iii++) {
                    const frame = Math.floor(startFrame + ii * framesPerPixel + iii);
                    const bin = Math.floor(startBin + jj * binsPerPixel + jjj);

                    if(frame < specData.data.length && bin < specData.data[0].length && 
                       specData.data[frame][bin] > threshold) {
                        flag = true;
                    }
                }
            }

            if(wasFlag != flag || lastBinRow[ii] != flag) {
                ctx.fillRect(specCanvasWindow.x + x + ii, specCanvasWindow.y - y2 - jj, 1, 1);
            }
            wasFlag = flag;
            lastBinRow[ii] = flag;
        }
    }
}

function drawSelectionOverlay(specData, signalWindowMapping, specCanvasWindow, selectionBox, mainImage, ctx) {
    // Clear canvas and draw base image
    ctx.putImageData(mainImage, 0, 0);

    // Draw magnitude boundary
    drawMagnitudeBoundary(specData, signalWindowMapping, specCanvasWindow, selectionBox, ctx);

    // Return the overlay image
    return {
        overlayImage: ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    };
} 