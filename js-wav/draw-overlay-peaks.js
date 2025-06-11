"use strict";

function drawCircle(ctx, specCanvasWindow, point, firstBin, framesPerPixel, binsPerPixel, color, label = null, radius = 6) {
    // Calculate x and y coordinates from point data
    const point_x = Math.floor((point.frame + 0.5) / framesPerPixel);
    const point_y = Math.floor((point.bin - firstBin + 0.5) / binsPerPixel);
    
    // Draw the circle
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(specCanvasWindow.x + point_x, specCanvasWindow.y - point_y, radius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw label above the point if provided
    if (label) {
        ctx.fillStyle = color;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        // Position label above the circle
        const labelX = specCanvasWindow.x + point_x;
        const labelY = specCanvasWindow.y - point_y - radius - 5;
        
        // Draw label background for better visibility
        const labelWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(labelX - labelWidth/2 - 2, labelY - 12, labelWidth + 4, 14);
        
        // Draw the label text
        ctx.fillStyle = color;
        ctx.fillText(label, labelX, labelY);
    }
}

function drawFoundPeaks(firstFrame, lastFrame, firstBin, lastBin, specCanvasWindow, foundPeaks, ctx, specData) {
    let numFrames = lastFrame - firstFrame;
    let numBins   = lastBin - firstBin;

    const framesPerPixel = numFrames / specCanvasWindow.width;
    const binsPerPixel = numBins / specCanvasWindow.height;

    const bar_color = magnitudeToRGBDark(0.9, 0, 1);
    const box_color = magnitudeToRGBDark(0.9, 0, 1, 0.2);

    const pth_color = 'rgb( 0 128 255 )';

    for(let i=0; i<foundPeaks.length; i++) {
        const x = Math.floor((foundPeaks[i].box.leftFrame+0.5) / framesPerPixel);
        const delta = Math.max(Math.round((foundPeaks[i].box.rightFrame + 0.5 - foundPeaks[i].box.leftFrame) / framesPerPixel), 1);

        const y1 = Math.floor((foundPeaks[i].box.maxBin - firstBin + 0.5) / binsPerPixel);
        const y2 = Math.floor((foundPeaks[i].box.minBin - firstBin + 0.5) / binsPerPixel);
        const bin_delta = y1-y2;

        // Draw peak box
        /*
        ctx.fillStyle = box_color;
        ctx.fillRect(specCanvasWindow.x + x, specCanvasWindow.y - y1, delta, y1-y2);
        */

        // Draw peak bar
        ctx.fillStyle = bar_color;
        ctx.fillRect(specCanvasWindow.x + x, specCanvasWindow.y - specCanvasWindow.height + 5, delta, 3);

        function drawRidgePath(path, framesPerPixel, binsPerPixel, specCanvasWindow, color, ctx) {
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

        drawRidgePath(foundPeaks[i].box.path, framesPerPixel, binsPerPixel, specCanvasWindow, pth_color, ctx);

        if(delta>100) {
            // Draw circles around key points using values calculated by getBoxStats
            const box = foundPeaks[i].box;
            if (!box.maxFreqPoint || !box.minFreqPoint || !box.maxMagPoint) getBoxStats(foundPeaks[i]);

            // Max frequency point
            drawCircle(ctx, specCanvasWindow, box.maxFreqPoint, firstBin, framesPerPixel, binsPerPixel, 'white', 'Fmax');

            // Min frequency point
            drawCircle(ctx, specCanvasWindow, box.minFreqPoint, firstBin, framesPerPixel, binsPerPixel, 'white', 'Fmin');

            // Max magnitude point
            drawCircle(ctx, specCanvasWindow, box.maxMagPoint, firstBin, framesPerPixel, binsPerPixel, 'white', 'FME');

            // Characteristic frequency point
            drawCircle(ctx, specCanvasWindow, box.characteristicFreqPoint, firstBin, framesPerPixel, binsPerPixel, 'white', 'Fc');

            // Knee frequency point
            drawCircle(ctx, specCanvasWindow, box.kneeFreqPoint, firstBin, framesPerPixel, binsPerPixel, 'white', 'Fknee');
        }
    }
}

function drawPeaksOverlay(peaks, signalWindowMapping, specCanvasWindow, mainImage, ctx, specData) {
    ctx.putImageData(mainImage, 0, 0);

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    drawFoundPeaks(signalWindowMapping.startFrame, signalWindowMapping.stopFrame, signalWindowMapping.firstBin, signalWindowMapping.lastBin, specCanvasWindow, peaks, ctx, specData);

    return {overlayImage: ctx.getImageData(0, 0, width, height)};
}
