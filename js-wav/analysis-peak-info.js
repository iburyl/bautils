"use strict";

function calculatePeak(sampleRate, spectrogramData, peakFreq)
{
    const fftSize = spectrogramData[0].length-1;
    const numBins = fftSize+1;
    const binsPerKHz = numBins/sampleRate*1000;        

    let searchMinFreq = params.peak.minFreq.read();
    let searchMaxFreq = params.peak.maxFreq.read();
    if(searchMaxFreq == 0) searchMaxFreq = sampleRate/2/1000;

    let searchFirstBin = Math.min(Math.floor(binsPerKHz * searchMinFreq), fftSize);
    let searchLastBin = Math.min(searchFirstBin + Math.floor((searchMaxFreq - searchMinFreq) * binsPerKHz), numBins);

    let searchFreqPeak={value:0, frame:0, bin:0};

    for(let frame=0; frame<spectrogramData.length; frame++)
    {
        for(let bin=searchFirstBin; bin<searchLastBin; bin++)
        {
            const magnitude = spectrogramData[frame][bin];
            if(magnitude > searchFreqPeak.value) searchFreqPeak = {value:magnitude, frame:frame, bin:bin};
        }
    }

    const sortedFreq = peakFreq.toSorted((a, b) => a - b);
    const magNoiseThreshold = sortedFreq[ Math.round(0.1 * (sortedFreq.length - 1)) ] * 10;

    const value = bilinear(spectrogramData, searchFreqPeak.frame, searchFreqPeak.bin);
    
    searchFreqPeak.box = getBox(searchFreqPeak, spectrogramData, searchFirstBin, searchLastBin, magNoiseThreshold);

    return searchFreqPeak;
}

function getBoxStats(peak)
{
    const path = peak.box.path;
    const noiseThreshold = -20 * Math.log10(peak.value / peak.box.magNoiseThreshold);
    
    // Find the peak point in the merged path (should be the point with highest value)
    let peakIndex = 0;
    let maxValue = path[0].value;
    for(let i = 1; i < path.length; i++) {
        if(path[i].value > maxValue) {
            maxValue = path[i].value;
            peakIndex = i;
        }
    }
    
    // Calculate magnitude drops separately for left and right
    const leftMagnitudeDrop = peakIndex > 0 ? 
        -20 * Math.log10(peak.value / path[0].value) : 0;
    const rightMagnitudeDrop = peakIndex < path.length - 1 ? 
        -20 * Math.log10(peak.value / path.at(-1).value) : 0;

    function calculateFrequencySum(pathSegment)
    {
        let pointsInFrame=0;
        let sumInFrame=0;
        let sum=0;
        let frames=0;

        for(let i=1; i<pathSegment.length; i++)
        {
            pointsInFrame++;
            sumInFrame += pathSegment[i].bin;

            if(pathSegment[i].frame != pathSegment[i-1].frame)
            {
                sum += sumInFrame / pointsInFrame;
                frames++;

                pointsInFrame = 0;
                sumInFrame = 0;
            }
        }

        return [sum, frames];
    }

    const [pathSum, pathFrames] = calculateFrequencySum(path);
    const Fmean = pathSum / pathFrames;
    
    // Calculate frequencies from path
    const left_freq = path[0].bin;
    const right_freq = path.at(-1).bin;
    
    // Calculate min/max frequencies from entire path and find key points
    let minFreq = path[0].bin;
    let maxFreq = path[0].bin;
    let minFreqPoint = path[0];
    let maxFreqPoint = path[0];
    let maxMagPoint = path[peakIndex];
    
    for(const point of path) {
        if(point.bin < minFreq) {
            minFreq = point.bin;
            minFreqPoint = point;
        }
        if(point.bin > maxFreq) {
            maxFreq = point.bin;
            maxFreqPoint = point;
        }
    }

    peak.box.leftMagnitudeDrop = leftMagnitudeDrop;
    peak.box.rightMagnitudeDrop = rightMagnitudeDrop;
    peak.box.noiseThreshold = noiseThreshold;
    peak.box.leftFrame = peak.box.leftFrame;
    peak.box.rightFrame = peak.box.rightFrame;
    peak.box.leftFreq = left_freq;
    peak.box.rightFreq = right_freq;
    peak.box.minFreq = minFreq;
    peak.box.maxFreq = maxFreq;
    peak.box.meanFreq = Fmean;
    peak.box.minFreqPoint = minFreqPoint;
    peak.box.maxFreqPoint = maxFreqPoint;
    peak.box.maxMagPoint = maxMagPoint;
}

function detectRidgeSubPixel(lastFrame, lastBin, binWindow, frameDirection, lastYMove, spectrogramData)
{
    const numFrames = spectrogramData.length;
    const numBins = spectrogramData[0].length;

    if(lastYMove == 0)
    {
        const upRidge = detectRidgeSubPixel(lastFrame, lastBin, binWindow, frameDirection, Math.PI*3/2, spectrogramData);
        const downRidge = detectRidgeSubPixel(lastFrame, lastBin, binWindow, frameDirection, Math.PI/2, spectrogramData);

        if(upRidge.value > downRidge.value) return upRidge; else return downRidge;
    }

    // Quick trend calculation from last move only (no array operations)
    let center = lastYMove;
    
    // Fixed search window for performance (no adaptive sizing)
    const angleWindow = Math.PI/2;
    const Npoints = 7; // Reduced search points for speed
    const angleStep = angleWindow / (Npoints + 1);

    // Collect all candidates for weighted averaging
    let totalWeight = 0;
    let weightedAngleSum = 0;
    
    for(let j = 0; j < Npoints; j++)
    {
        const angle = center + (j+1)*angleStep - angleWindow / 2;
        
        let frame = lastFrame + Math.sin(angle) * frameDirection;
        let bin   = lastBin   + Math.cos(angle) * binWindow;
        
        // Bounds checking
        if (frame < 0 || frame >= numFrames || bin < 0 || bin >= numBins) continue;
        
        const value = bilinear(spectrogramData, frame, bin);
        
        // Weight value based on angle change from previous direction
        const combinedWeight = value;
        
        // Accumulate weighted sums
        totalWeight += combinedWeight;
        weightedAngleSum += angle * combinedWeight;
    }

    const avgAngle = Math.max(Math.PI/100, Math.min(weightedAngleSum / totalWeight, Math.PI - Math.PI/100));
    
    // Calculate weighted averages
    const avgFrame = lastFrame + Math.sin(avgAngle) * frameDirection;
    const avgBin = lastBin + Math.cos(avgAngle) * binWindow;
    const value = bilinear(spectrogramData, avgFrame, avgBin);
    
    return {
        frame: avgFrame,
        bin: avgBin,
        value: value,
        lastYMove: avgAngle
    };
}

function getBox(peakStat, spectrogramData, lowBin, upperBin, magNoiseThreshold=0) {
    const detectRidge = detectRidgeSubPixel;

    let startFrame = peakStat.frame;
    let startBin = peakStat.bin;
    let value = peakStat.value;

    const numFrames = spectrogramData.length;
    const numBins   = spectrogramData[0].length;

    let binWindow=3;

    const leftMagDropInDB = (params.peak.leftMagFall.value != 0) ? params.peak.leftMagFall.read() : -30;
    const leftMagDropCoeff = Math.pow(10,leftMagDropInDB/20);
    const leftNoiseThreshold = (params.peak.leftMagFall.value != 0) ? 0 : magNoiseThreshold;
    const rightMagDropInDB = (params.peak.rightMagFall.value != 0) ? params.peak.rightMagFall.read() : -30;
    const rightMagDropCoeff = Math.pow(10,rightMagDropInDB/20);
    const rightNoiseThreshold = (params.peak.rightMagFall.value != 0) ? 0 : magNoiseThreshold;

    let rightPath = [];
    let leftPath = [];
    let maxF = startBin;
    let minF = startBin;
    
    function makePath(firstPoint, direction, spectrogramData, magDropCoeff, magNoiseThreshold, path) {
        let nextPoint = firstPoint;
        for(let maxPoints=numFrames; maxPoints>0; maxPoints--)
        {
            nextPoint = detectRidge(nextPoint.frame, nextPoint.bin, binWindow, direction, nextPoint.lastYMove, spectrogramData);
            if(maxPoints==numFrames) firstPoint.lastYMove = Math.PI - nextPoint.lastYMove;
            value = Math.max(nextPoint.value, value);
            path.push({bin:nextPoint.bin, frame:nextPoint.frame, value:nextPoint.value});
            maxF = Math.max(maxF, nextPoint.bin);
            minF = Math.min(minF, nextPoint.bin);
            if(nextPoint.value < Math.max(value*magDropCoeff, magNoiseThreshold) || nextPoint.frame + direction < 0 || nextPoint.frame + direction > numFrames-1) break;
        }
    }

    let firstPoint = {frame:startFrame, bin:startBin, value:value, lastYMove:0};

    makePath(firstPoint, +1, spectrogramData, rightMagDropCoeff, rightNoiseThreshold, rightPath);
    makePath(firstPoint, -1, spectrogramData, leftMagDropCoeff, leftNoiseThreshold, leftPath);
    
    // Merge paths into a single path with starting point in the middle
    const singlePath = [
        ...leftPath.reverse(),
        {bin: startBin, frame: startFrame, value: value},
        ...rightPath
    ];
    
    const right = singlePath[singlePath.length - 1].frame;
    const left  = singlePath[0].frame;

    return {
        leftFrame:left, rightFrame:right,
        minBin: minF, maxBin: maxF,
        path: singlePath,
        magNoiseThreshold: magNoiseThreshold };
}
