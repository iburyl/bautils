function drawSpectrogramWindow(firstFrame, lastFrame, firstBin, lastBin, specCanvasWindow, specData, minE, ctx) {
    let numFrames = lastFrame - firstFrame;
    let numBins   = lastBin - firstBin;

    // Draw spectrogram
    const framesPerPixel = Math.max(Math.floor(numFrames / specCanvasWindow.width), 1);
    const binsPerPixel = Math.max(Math.floor(numBins / specCanvasWindow.height), 1);

    for(let x=0; x<specCanvasWindow.width; x++) {
        for(let y=0; y<specCanvasWindow.height; y++) {
            let firstPixelFrame = firstFrame + Math.floor(x * numFrames / specCanvasWindow.width);
            let firstPixelBin = firstBin + Math.floor(y * numBins / specCanvasWindow.height);

            let value = specData.data[firstPixelFrame][firstPixelBin];

            if(framesPerPixel*binsPerPixel > 1)
            {
                for(let xx=0; xx<framesPerPixel; xx++) {
                    for(let yy=0; yy<binsPerPixel; yy++) {
                        value = Math.max(value, specData.data[firstPixelFrame + xx][firstPixelBin + yy]);
                    }
                }
            }

            let normalizedValue = Math.log(value);
            let minLog = minE;
            if(normalizedValue < minLog) normalizedValue = minLog;
            normalizedValue = (normalizedValue - minLog) / (Math.log(specData.maxValue) - minLog);

            const colorValue = 255 - Math.floor(normalizedValue * 255);
            ctx.fillStyle = `rgb(${colorValue}, ${colorValue}, ${colorValue})`;

            ctx.fillStyle = magnitudeToRGBDark(normalizedValue, 0, 1);
            ctx.fillRect(specCanvasWindow.x+x, specCanvasWindow.y-y, 1, 1);
        }
    }
}

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

function drawTimeWindow(firstFrame, lastFrame, timeCanvasWindow, timeData, ctx) {
    let numFrames = lastFrame - firstFrame;

    const framesPerPixel = Math.max(Math.floor(numFrames / timeCanvasWindow.width), 1);

    ctx.fillStyle = magnitudeToRGBDark(0, 0, 1);
    ctx.fillRect(timeCanvasWindow.x, timeCanvasWindow.y-timeCanvasWindow.height, timeCanvasWindow.width, timeCanvasWindow.height);

    const bar_color = magnitudeToRGBDark(1, 0, 1);

    ctx.fillStyle = bar_color;

    for(let x=0; x<timeCanvasWindow.width; x++) {
        let firstPixelFrame = firstFrame + Math.floor(x * numFrames / timeCanvasWindow.width);

        let value = timeData.data[firstPixelFrame];

        if(framesPerPixel > 1)
        {
            for(let xx=0; xx<framesPerPixel; xx++) {
                value = Math.max(value, timeData.data[firstPixelFrame + xx]);
            }
        }

        const normalizedValue = (value - timeData.minValue)/(timeData.maxValue - timeData.minValue);
        const barHeight = normalizedValue*timeCanvasWindow.height;

        ctx.fillRect(timeCanvasWindow.x+x, timeCanvasWindow.y-barHeight, 1, barHeight);
    }
}

function drawFreqWindow(firstBin, lastBin, freqCanvasWindow, freqData, ctx) {
    let numBins   = lastBin - firstBin;

    const binsPerPixel = Math.max(Math.floor(numBins / freqCanvasWindow.height), 1);

    ctx.fillStyle = magnitudeToRGBDark(0, 0, 1);
    ctx.fillRect(freqCanvasWindow.x, freqCanvasWindow.y-freqCanvasWindow.height, freqCanvasWindow.width, freqCanvasWindow.height);

    const bar_color = magnitudeToRGBDark(1, 0, 1);

    ctx.fillStyle = bar_color;

    for(let y=0; y<freqCanvasWindow.height; y++) {
        let firstPixelBin = firstBin + Math.floor(y * numBins / freqCanvasWindow.height);

        let value = freqData.data[firstPixelBin];

        if(binsPerPixel > 1)
        {
            for(let yy=0; yy<binsPerPixel; yy++) {
                value = Math.max(value, freqData.data[firstPixelBin + yy]);
            }
        }

        const normalizedValue = (value - freqData.minValue)/(freqData.maxValue - freqData.minValue);
        const barWidth = normalizedValue*freqCanvasWindow.width;

        ctx.fillRect(freqCanvasWindow.x, freqCanvasWindow.y - y, barWidth, 1);
    }
}

function drawSpectrogram(specData, timeData, freqData, foundPeaks, signalWindow, minE, ctx) {
    const duration = signalWindow.duration;
    const sampleRate = signalWindow.sampleRate;

    // Constants for axis drawing
    const AXIS_Y_PADDING = 50;
    const AXIS_X_PADDING = 30;
    const TICK_LENGTH = 5;
    const LABEL_PADDING = 5;

    const AXIS_X_TIME_PADDING = 60;
    const AXIS_Y_FREQ_PADDING = 60;

    const width = mainCanvas.width;
    const height = mainCanvas.height;
    const numFrames = specData.data.length;
    const numBins = specData.data[0].length;

    // Calculate spectrogram dimensions
    const spectrogramWidth = width - AXIS_Y_PADDING - AXIS_Y_FREQ_PADDING;
    const spectrogramHeight = height - AXIS_X_PADDING - AXIS_X_TIME_PADDING;
    const spectrogramX = AXIS_Y_PADDING;
    const spectrogramY = height - AXIS_X_PADDING;

    const timeWidth = spectrogramWidth;
    const timeHeight = AXIS_X_TIME_PADDING;
    const timeX = spectrogramX;
    const timeY = AXIS_X_TIME_PADDING;

    const freqWidth = AXIS_Y_FREQ_PADDING;
    const freqHeight = spectrogramHeight;
    const freqX = spectrogramX + spectrogramWidth;
    const freqY = spectrogramY;

    let specCanvasWindow = {x: spectrogramX, y:spectrogramY, width:spectrogramWidth, height:spectrogramHeight};
    let timeCanvasWindow = {x: timeX, y: timeY, width:timeWidth, height:timeHeight};
    let freqCanvasWindow = {x: freqX+1, y: freqY, width:freqWidth, height:freqHeight};

    // Clear mainCanvas
    ctx.clearRect(0, 0, width, height);

    const binsPerKHz = numBins/sampleRate*1000;
    
    const firstBin = Math.floor(signalWindow.minFreq * binsPerKHz);
    const lastBin = Math.min(firstBin + Math.floor((signalWindow.maxFreq - signalWindow.minFreq) * binsPerKHz), numBins);

    drawSpectrogramWindow(0, numFrames, firstBin, lastBin, specCanvasWindow, specData, minE, ctx);
    drawFoundPeaks(0, numFrames, firstBin, lastBin, specCanvasWindow, foundPeaks, ctx);
    drawTimeWindow(0, numFrames, timeCanvasWindow, timeData, ctx);
    drawFreqWindow(firstBin, lastBin, freqCanvasWindow, freqData, ctx);

    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
            
    ctx.font = '10px Arial';
    ctx.fillStyle = `#000`;

    drawTimeAxisX(signalWindow, specCanvasWindow, TICK_LENGTH, LABEL_PADDING, ctx);
    drawFreqAxisY(signalWindow, specCanvasWindow, TICK_LENGTH, LABEL_PADDING, ctx);

    return {image: ctx.getImageData(0, 0, width, height), specCanvasWindow: specCanvasWindow};
}
