"use strict";

function getBoxStats(peak)
{
    const minMagnitudeDrop = 20 * Math.min(Math.log10(peak.value / peak.box.leftPath.at(-1).value), Math.log10(peak.value / peak.box.rightPath.at(-1).value));
    const noiseThreshold = 20 * Math.log10(peak.value / peak.box.magNoiseThreshold);

    //console.log(peak.box.magNoiseThreshold);

    function getSum(path)
    {
        let pointsInFrame=0;
        let sumInFrame=0;
        let sum=0;
        let frames=0;

        for(let i=1; i<path.length; i++)
        {
            pointsInFrame++;
            sumInFrame += path[i].bin;

            if(path[i].frame != path[i-1].frame)
            {
                sum += sumInFrame / pointsInFrame;
                frames++;

                pointsInFrame = 0;
                sumInFrame = 0;
            }
        }

        return [sum, frames];
    }

    const [lSum, lFrames] = getSum(peak.box.leftPath);
    const [rSum, rFrames] = getSum(peak.box.rightPath);
    const Fmean = (lSum+rSum)/(lFrames+rFrames);
    //console.log(lSum, lFrames);
    //console.log(rSum, rFrames);
    //console.log(Fmean);

    peak.box.magnitudeDrop = minMagnitudeDrop;
    peak.box.noiseThreshold = noiseThreshold;
    peak.box.left = peak.box.leftFrame;
    peak.box.right = peak.box.rightFrame;
    peak.box.left_freq = peak.box.leftPath.at(-1).bin;
    peak.box.right_freq = peak.box.rightPath.at(-1).bin;
    peak.box.minFreq = peak.box.minBin;
    peak.box.maxFreq = peak.box.maxBin;
    peak.box.meanFreq = Fmean;
}

function detectRidgeQuick(lastFrame, lastBin, binWindow, frameDirection, lastYMove, spectrogramData)
{
    const frame=lastFrame+frameDirection;
    const numBins=spectrogramData[0].length;

    let binWindowStart = Math.max(lastBin-binWindow, 0);
    let binWindowStop  = Math.min(lastBin+binWindow, numBins);

    let inFramePeakBin = binWindowStart;
    let inFramePeakValue = spectrogramData[frame][inFramePeakBin];
    
    // check +/- binWIndow and find next peak
    for(let j=binWindowStart; j<=binWindowStop; j++) if(spectrogramData[frame][j] > inFramePeakValue) {inFramePeakValue=spectrogramData[frame][j]; inFramePeakBin=j;}
    
    // if it went out of small search window, find further for local maximum,
    // following outside of the window, while it monotonically increses the value
    if(inFramePeakBin==binWindowStart)
    {
        while(inFramePeakBin>0)
        {
            if(spectrogramData[frame][inFramePeakBin-1] < inFramePeakValue) break;
            inFramePeakBin -= 1;
            inFramePeakValue=spectrogramData[frame][inFramePeakBin];
        }
    }
    if(inFramePeakBin==binWindowStop)
    {
        while(inFramePeakBin<numBins-1)
        {
            if(spectrogramData[frame][inFramePeakBin+1] < inFramePeakValue) break;
            inFramePeakBin += 1;
            inFramePeakValue=spectrogramData[frame][inFramePeakBin];
        }
    }

    return {frame:frame, bin:inFramePeakBin, value:inFramePeakValue, lastYMove:0};
}

function detectRidgeSlow(lastFrame, lastBin, binWindow, frameDirection, lastYMove, spectrogramData)
{
    const numFrames = spectrogramData.length;
    const numBins = spectrogramData[0].length;

    let frame = lastFrame;

    let binWindowStart = Math.max((lastYMove>0)?lastBin+1:lastBin-binWindow, 0);
    let binWindowStop  = Math.min((lastYMove<0)?lastBin-1:lastBin+binWindow, numBins-1);

    let maxFrame = lastFrame;
    let maxBin   = binWindowStart;
    let maxValue = spectrogramData[maxFrame][maxBin];

    for(let j=binWindowStart; j<=binWindowStop; j++) if(spectrogramData[lastFrame][j] > maxValue && j!=lastBin) {maxValue=spectrogramData[lastFrame][j]; maxBin=j;}

    const nextFrame = lastFrame+frameDirection;
    if(nextFrame >= numFrames || nextFrame < 0 ) return {frame:maxFrame, bin:maxBin, value:maxValue, lastYMove:(maxFrame==lastFrame)?maxBin-lastBin:0};
    
    binWindowStart = Math.max(lastBin-binWindow, 0);
    binWindowStop  = Math.min(lastBin+binWindow, numBins-1);

    for(let j=binWindowStart; j<=binWindowStop; j++) if(spectrogramData[lastFrame+frameDirection][j] > maxValue) {maxValue=spectrogramData[lastFrame+frameDirection][j]; maxFrame=lastFrame+frameDirection; maxBin=j;}

    return {frame:maxFrame, bin:maxBin, value:maxValue, lastYMove:(maxFrame==lastFrame)?maxBin-lastBin:0};
}

function detectRidgeSubPixel(lastFrame, lastBin, binWindow, frameDirection, lastYMove, spectrogramData)
{
    const numFrames = spectrogramData.length;
    const numBins = spectrogramData[0].length;

    const center = (lastYMove == 0)?Math.PI/2:lastYMove;
    const angleWindow = (lastYMove == 0)?Math.PI:Math.PI/2;
    
    const Npoints = 7;
    const angleStep = angleWindow / (Npoints+1);

    let maxFrame  = lastFrame;
    let maxBin    = lastBin+frameDirection;
    let maxValue  = bilinear(spectrogramData, lastFrame, lastBin+frameDirection); //spectrogramData[lastFrame][lastBin+frameDirection];
    let lastMove  = Math.PI / 2;

    for(let j=0; j<Npoints; j++)
    {
        const angle = center + (j+1)*angleStep - angleWindow / 2;

        if(angle <= 0 || angle >= Math.PI) continue;

        let frame = lastFrame + Math.sin(angle)*frameDirection;
        let bin   = lastBin   + Math.cos(angle)*binWindow;

        const value = bilinear(spectrogramData, frame, bin);

        if(value > maxValue) {maxValue=value; maxFrame=frame; maxBin=bin; lastMove=angle;}
    }

    return {frame:maxFrame, bin:maxBin, value:maxValue, lastYMove:lastMove};
}

function getBox(peakStat, spectrogramData, lowBin, upperBin, magNoiseThreshold) {
    //const detectRidge = detectRidgeSlow;
    //const detectRidge = detectRidgeQuick;
    const detectRidge = detectRidgeSubPixel;

    let startFrame = peakStat.frame;
    let startBin = peakStat.bin;
    let value = peakStat.value;
    magNoiseThreshold = (magNoiseThreshold)?magNoiseThreshold:0;

    const numFrames = spectrogramData.length;
    const numBins   = spectrogramData[0].length;

    let binWindow=3;

    const magDropInDB = 30;
    const magDropCoeff = Math.pow(10,-magDropInDB/20);

    let rightPath = [];
    let leftPath = [];
    let maxF = startBin;
    let minF = startBin;
    
    function makePath(firstPoint, direction, spectrogramData, path) {
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

    makePath(firstPoint, +1, spectrogramData, rightPath);
    makePath(firstPoint, -1, spectrogramData, leftPath);
    
    const right = (rightPath.length>0)?rightPath[rightPath.length-1].frame:startFrame;
    const left  = (leftPath.length>0)?leftPath[leftPath.length-1].frame:startFrame;

    return {
        leftFrame:left, rightFrame:right,
        minBin: minF, maxBin: maxF,
        leftPath: leftPath, rightPath: rightPath,
        magNoiseThreshold: magNoiseThreshold };
}
