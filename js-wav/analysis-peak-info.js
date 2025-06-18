"use strict";

// Find the peak frequency within the specified search range and create a box around it
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

    searchFreqPeak.box = traceRidge(searchFreqPeak, spectrogramData, searchFirstBin, searchLastBin, magNoiseThreshold);
    getRidgeStats(searchFreqPeak);

    return searchFreqPeak;
}

// Calculate the mean frequency of a path segment by averaging frequencies within each frame
function calculateMeanFrequency(pathSegment)
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

    return frames > 0 ? sum / frames : null;
}

// Calculate slopes between consecutive points (frequency change per frame)
function calculateSlopes(path) {
    if(path.length < 2) return;
    
    // First point has no incoming slope
    path[0].slope = null;
    
    for(let i = 1; i < path.length; i++) {
        const deltaFrame = path[i].frame - path[i-1].frame;
        const deltaBin = path[i].bin - path[i-1].bin;
        // Handle case where frames are the same (avoid division by zero)
        const slope = deltaFrame !== 0 ? deltaBin / deltaFrame : 0;
        
        // Add slope to the current point (slope leading TO this point)
        path[i].slope = slope;
    }
    if(path.length > 1) path[0].slope = path[1].slope;
}

// Calculate knee frequency - point where deviation from linear approximation between start and end is minimal
function findKneeFrequencyPoint(path, startPoint, endPoint) {
    if(path.length < 5) return {freq: path[0].bin, point: path[0]}; // Not enough points to detect slope changes
    
    const startIndex = startPoint.index;
    const endIndex = endPoint.index;
    
    if(endIndex - startIndex < 5) return {freq: path[startIndex].bin, point: path[startIndex]}; // Not enough points in range
    
    let minTotalError = Infinity;
    let kneeIndex = startIndex + Math.floor((endIndex - startIndex) / 2); // Default to middle
    
    // Test each potential knee point
    for(let i = startIndex + 1; i < endIndex; i++) {
        let totalError = 0;
        
        // Calculate linear approximation for left segment (start to knee point)
        const leftStartBin = path[startIndex].bin;
        const leftStartFrame = path[startIndex].frame;
        const leftEndBin = path[i].bin;
        const leftEndFrame = path[i].frame;
        
        const leftFrameDiff = leftEndFrame - leftStartFrame;
        const leftBinDiff = leftEndBin - leftStartBin;
        const leftSlope = leftFrameDiff !== 0 ? leftBinDiff / leftFrameDiff : 0;
        const leftIntercept = leftStartBin - leftSlope * leftStartFrame;
        
        // Calculate linear approximation for right segment (knee point to end)
        const rightStartBin = path[i].bin;
        const rightStartFrame = path[i].frame;
        const rightEndBin = path[endIndex].bin;
        const rightEndFrame = path[endIndex].frame;
        
        const rightFrameDiff = rightEndFrame - rightStartFrame;
        const rightBinDiff = rightEndBin - rightStartBin;
        const rightSlope = rightFrameDiff !== 0 ? rightBinDiff / rightFrameDiff : 0;
        const rightIntercept = rightStartBin - rightSlope * rightStartFrame;
        
        // Calculate error for left segment
        for(let j = startIndex; j <= i; j++) {
            const point = path[j];
            const expectedBin = leftSlope * point.frame + leftIntercept;
            const binError = Math.abs(point.bin - expectedBin);
            totalError += binError;
        }
        
        // Calculate error for right segment
        for(let j = i; j <= endIndex; j++) {
            const point = path[j];
            const expectedBin = rightSlope * point.frame + rightIntercept;
            const binError = Math.abs(point.bin - expectedBin);
            totalError += binError;
        }
        
        // Find point with minimum total error
        if(totalError < minTotalError) {
            minTotalError = totalError;
            kneeIndex = i;
        }
    }
    
    return path[kneeIndex];
}

// Calculate Characteristic frequency - frequency at the right hand end of the portion with lowest absolute slope
function findCharacteristicFrequencyPoint(path) {
    if(path.length < 3) return path.at(-1); // Not enough points to apply sliding window approach

    // Find the portion with lowest absolute slope using a sliding window approach
    const numSlopes = path.length - 1; // Number of slope segments
    const windowSize = Math.max(3, Math.floor(numSlopes / 5)); // Adaptive window size
    let minAvgAbsSlope = Infinity;
    let bestWindowEnd = numSlopes - 1;
    
    for(let start = 0; start <= numSlopes - windowSize; start++) {
        let sumAbsSlope = 0;
        for(let i = start; i < start + windowSize; i++) {
            // Read slope from path point (i+1 because slopes start from index 1)
            sumAbsSlope += Math.abs(path[i + 1].slope);
        }
        const avgAbsSlope = sumAbsSlope / windowSize;
        
        if(avgAbsSlope < minAvgAbsSlope) {
            minAvgAbsSlope = avgAbsSlope;
            bestWindowEnd = start + windowSize - 1;
        }
    }
    
    const rightEndIndex = Math.min(bestWindowEnd + 1, path.length - 1);
    return path[rightEndIndex];
}

function calculateCallType(path) {
    if (!path || path.length < 2) return '';
    
    const signalWindow = window.sharedSignalWindow;
    const sampleRate = signalWindow.sampleRate;

    const numBins = window.sharedData.specData.data[0].length;
    const numFrames = window.sharedData.specData.data.length;

    const binToKHz = (sampleRate / 1000) / numBins;
    const framesPerSec = numFrames / signalWindow.duration;
    const framesPerMillisec = framesPerSec / 1000;
    const slopeCoeff = binToKHz * framesPerMillisec;

    // Convert slope from bins/frame to kHz/ms
    const slopeToKHzPerMs = (slope) => { return slope * slopeCoeff; };

    // Helper function to add section only if different from last one
    const pushIfDifferent = (type) => {
        if (type && (sections.length === 0 || sections[sections.length - 1] !== type)) {
            sections.push(type);
        }
    };

    // Helper function to calculate section type based on linear slope between points
    const getSectionType2 = (startPoint, endPoint) => {
        const timeInMs = (endPoint.frame - startPoint.frame) / framesPerMillisec;

        // Calculate linear slope between points
        const slope = (endPoint.bin - startPoint.bin) / (endPoint.frame - startPoint.frame);
        const slopeInKHzPerMs = Math.abs(slope * slopeCoeff);
        
        let type = '';
        
        if (slopeInKHzPerMs < 0.1) type = 'cf';
        else if (slopeInKHzPerMs <= 1.0) type = 'qcf';
        else type = 'fm';

        return {type: type, timeInMs: timeInMs};
    };

    // Find middle point
    const middleIndex = Math.floor(path.length / 2);
    const middlePoint = path[middleIndex];
    
    // Find knee points for left and right sections
    const leftKnee = findKneeFrequencyPoint(path, path[0], middlePoint);
    const rightKnee = findKneeFrequencyPoint(path, middlePoint, path[path.length - 1]);
    
    // Analyze each section
    let sections = [
        getSectionType2(path[0], leftKnee),
        getSectionType2(leftKnee, middlePoint),
        getSectionType2(middlePoint, rightKnee),
        getSectionType2(rightKnee, path[path.length - 1])
    ];

    let changed = true;
    while(changed)
    {
        changed = false;
        if(sections.length == 1) break;

        for(let i = 0; i < sections.length - 1; i++)
        {
            if(sections[i].type == sections[i + 1].type)
            {
                sections[i].timeInMs += sections[i + 1].timeInMs;
                sections.splice(i + 1, 1);
                changed = true;
                continue;
            }
        }
    }
    console.log(sections);
    sections = sections.filter(section => section.timeInMs > 1);    
    return sections.map(section => section.type).join('-');
}

// Calculate comprehensive statistics and measurements for a detected peak box
function getRidgeStats(peak)
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

    const Fmean = calculateMeanFrequency(path);
    
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
    
    const characteristicFreqPoint = findCharacteristicFrequencyPoint(path);

    const kneeFreqPoint = findKneeFrequencyPoint(path, path[0], characteristicFreqPoint);

    // Calculate Lower slope: knee to characteristic point slope
    const lowerSlope = (characteristicFreqPoint.frame !== kneeFreqPoint.frame) ? 
        (characteristicFreqPoint.bin - kneeFreqPoint.bin) / (characteristicFreqPoint.frame - kneeFreqPoint.frame) : 0;

    // Calculate Upper slope: high frequency (max freq) to knee slope  
    const upperSlope = (kneeFreqPoint.frame !== maxFreqPoint.frame) ?
        (kneeFreqPoint.bin - maxFreqPoint.bin) / (kneeFreqPoint.frame - maxFreqPoint.frame) : 0;

    // Calculate Total slope: from leftFrame to rightFrame
    const totalSlope = (peak.box.rightFrame !== peak.box.leftFrame) ?
        (right_freq - left_freq) / (peak.box.rightFrame - peak.box.leftFrame) : 0;

    peak.box.leftMagnitudeDrop = leftMagnitudeDrop;
    peak.box.rightMagnitudeDrop = rightMagnitudeDrop;
    peak.box.noiseThreshold = noiseThreshold;
    peak.box.leftFrame = peak.box.leftFrame;
    peak.box.rightFrame = peak.box.rightFrame;
    peak.box.leftFreq = left_freq;
    peak.box.rightFreq = right_freq;
    peak.box.meanFreq = Fmean;
    peak.box.lowerSlope = lowerSlope;
    peak.box.upperSlope = upperSlope;
    peak.box.totalSlope = totalSlope;
    peak.box.characteristicFreqPoint = characteristicFreqPoint;
    peak.box.kneeFreqPoint = kneeFreqPoint;
    peak.box.minFreqPoint = minFreqPoint;
    peak.box.maxFreqPoint = maxFreqPoint;
    peak.box.maxMagPoint = maxMagPoint;
    peak.box.myotisKnickFreqPoint = findKneeFrequencyPoint(path, characteristicFreqPoint, path[path.length - 1]);
    peak.box.ridgeType = calculateCallType(path);

    console.log(peak.box.myotisKnickFreqPoint);


    
}

// Detect the next ridge point using sub-pixel precision with weighted angle averaging
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

// Create a bounding box around a peak by tracing ridge paths in both directions
function traceRidge(peakStat, spectrogramData, lowBin, upperBin, magNoiseThreshold=0) {
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
    
    // Trace a ridge path in one direction until magnitude drops below threshold
    function makePath(firstPoint, direction, spectrogramData, magDropCoeff, magNoiseThreshold, path) {
        let nextPoint = firstPoint;
        for(let maxPoints=numFrames; maxPoints>0; maxPoints--)
        {
            nextPoint = detectRidge(nextPoint.frame, nextPoint.bin, binWindow, direction, nextPoint.lastYMove, spectrogramData);
            value = Math.max(nextPoint.value, value);
            path.push({bin:nextPoint.bin, frame:nextPoint.frame, value:nextPoint.value});
            maxF = Math.max(maxF, nextPoint.bin);
            minF = Math.min(minF, nextPoint.bin);
            if(nextPoint.value < Math.max(value*magDropCoeff, magNoiseThreshold) || nextPoint.frame + direction < 0 || nextPoint.frame + direction > numFrames-1) break;
        }
    }

    let firstPoint = {frame:startFrame, bin:startBin, value:value, lastYMove:0};

    makePath(firstPoint, +1, spectrogramData, rightMagDropCoeff, rightNoiseThreshold, rightPath);
    firstPoint = rightPath[0];
    firstPoint.lastYMove=0;
    makePath(firstPoint, -1, spectrogramData, leftMagDropCoeff, leftNoiseThreshold, leftPath);
    
    // Merge paths into a single path with starting point in the middle
    const singlePath = [
        ...leftPath.reverse(),
        ...rightPath
    ];
    
    // Add index to each point
    singlePath.forEach((point, index) => {
        point.index = index;
    });
    
    const right = singlePath[singlePath.length - 1].frame;
    const left  = singlePath[0].frame;

    // Calculate slopes for all points
    calculateSlopes(singlePath);

    return {
        leftFrame:left, rightFrame:right,
        minBin: minF, maxBin: maxF,
        path: singlePath,
        magNoiseThreshold: magNoiseThreshold };
}
