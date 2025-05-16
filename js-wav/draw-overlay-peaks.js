"use strict";

function drawFoundPeaks(firstFrame, lastFrame, firstBin, lastBin, specCanvasWindow, foundPeaks, ctx) {
    let numFrames = lastFrame - firstFrame;
    let numBins   = lastBin - firstBin;

    const framesPerPixel = numFrames / specCanvasWindow.width;
    const binsPerPixel = numBins / specCanvasWindow.height;

    const bar_color = magnitudeToRGBDark(0.9, 0, 1);
    const box_color = magnitudeToRGBDark(0.9, 0, 1, 0.3);
    //const pth_color = 'rgb( 255 0 255 )';
    const pth_color = 'rgb( 255 255 255 )';
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

        
        function drawRidgePath(path, framesPerPixel, binsPerPixel, specCanvasWindow, color, ctx)
        {
            if(!path) return;

            if (path) {
                ctx.beginPath();
                let firstPoint = true;
                for(let j=0; j<path.length; j++) {
                    let x = Math.floor((path[j].frame+0.5) / framesPerPixel);
                    let y = Math.floor((path[j].bin - firstBin + 0.5) / binsPerPixel);
                    if (firstPoint) {
                        ctx.moveTo(specCanvasWindow.x + x, specCanvasWindow.y - y);
                        firstPoint = false;
                    } else {
                        ctx.lineTo(specCanvasWindow.x + x, specCanvasWindow.y - y);
                    }
                }
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        drawRidgePath(foundPeaks[i].box.leftPath, framesPerPixel, binsPerPixel, specCanvasWindow, pth_color_2, ctx);
        drawRidgePath(foundPeaks[i].box.rightPath, framesPerPixel, binsPerPixel, specCanvasWindow, pth_color, ctx);
    }
}

function drawPeaksOverlay(peaks, signalWindowMapping, specCanvasWindow, mainImage, ctx) {
    ctx.putImageData(mainImage, 0, 0);

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    drawFoundPeaks(signalWindowMapping.startFrame, signalWindowMapping.stopFrame, signalWindowMapping.firstBin, signalWindowMapping.lastBin, specCanvasWindow, peaks, ctx);

    return {overlayImage: ctx.getImageData(0, 0, width, height)};
}
