function getBox(peakStat, spectrogramData, lowBin, upperBin, prevBox, magNoiseThreshold) {
    let startFrame = peakStat.frame;
    let startBin = peakStat.bin;
    let value = peakStat.value;
    magNoiseThreshold = (magNoiseThreshold)?magNoiseThreshold:0;

    const numFrames = spectrogramData.length;
    const numBins   = spectrogramData[0].length;

    let binWindow=2;

    function detectRidge(frame, lastBin, binWindow, numBins, spectrogramData)
    {
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

        return {peakBin:inFramePeakBin, peakValue:inFramePeakValue};
    }

    let rightPath = [];
    let leftPath = [];
    let maxF_10 = startBin;
    let minF_10 = startBin;
    let right_10 = startFrame;
    let right_10_freq_bin = startBin;
    let left_10 = startFrame;
    let left_10_freq_bin = startBin;
    let lastBin = startBin;
    for(let i=startFrame; i<numFrames; i++)
    {
        const {peakBin, peakValue} = detectRidge(i, lastBin, binWindow, numBins, spectrogramData);
        value = Math.max(peakValue, value);
        lastBin = peakBin;
        if(peakValue < Math.max(value*0.05, magNoiseThreshold) || i==numFrames-1)
        {
            right_10 = i;
            right_10_freq_bin = peakBin;
            break;
        }
        rightPath.push({bin :peakBin, frame:i, value:peakValue});
        maxF_10 = Math.max(maxF_10, peakBin);
        minF_10 = Math.min(minF_10, peakBin);
    }
    lastBin = startBin;

    const prevBox_minBin = (prevBox)?Math.min(prevBox.left_10_freq, prevBox.right_10_freq):0;
    const prevBox_maxBin = (prevBox)?Math.max(prevBox.left_10_freq, prevBox.right_10_freq):0;
    for(let i=startFrame-1; i>=0; i--)
    {
        const {peakBin, peakValue} = detectRidge(i, lastBin, binWindow, numBins, spectrogramData);
        value = Math.max(peakValue, value);
        lastBin = peakBin;
        if(peakValue < Math.max(value*0.05, magNoiseThreshold) || i==0)
        {
            left_10 = i;
            left_10_freq_bin = peakBin;
            break;
        }
        if(prevBox && prevBox.right_10 >= i && peakBin > prevBox_minBin && peakBin < prevBox_maxBin)
        {
            left_10 = i;
            left_10_freq_bin = peakBin;
            break;
        }
        leftPath.push({bin:peakBin, frame:i, value:peakValue});
        maxF_10 = Math.max(maxF_10, peakBin);
        minF_10 = Math.min(minF_10, peakBin);
    }

    return {
        leftFrame:left_10, rightFrame:right_10,
        minBin: minF_10, maxBin: maxF_10,

        minFreq_10: minF_10, maxFreq_10: maxF_10,
        left_10:left_10, right_10: right_10,
        left_10_freq:left_10_freq_bin, right_10_freq:right_10_freq_bin,
        leftPath:leftPath, rightPath:rightPath };
}


function getBox2(peakStat, spectrogramData, lowBin, upperBin, prevBox, magNoiseThreshold) {
    let startFrame = peakStat.frame;
    let startBin = peakStat.bin;
    let value = peakStat.value;
    magNoiseThreshold = (magNoiseThreshold)?magNoiseThreshold:0;

    const numFrames = spectrogramData.length;
    const numBins   = spectrogramData[0].length;

    //let binWindow=Math.ceil((upperBin-lowBin)/20);
    //let binWindow=Math.ceil((upperBin-lowBin)/10);
    //let binWindow=Math.min(Math.ceil((upperBin-lowBin)/10),5);
    let binWindow=1;
    //for(let j=startBin; j<upperBin; j++) if(spectrogramData[startFrame][j] < value*0.1) { binWindow += j-startBin; break; }
    //for(let j=startBin; j>=lowBin; j--) if(spectrogramData[startFrame][j] < value*0.1) { binWindow += startBin-j; break; }
    //console.log(binWindow);

    function detectRidge(lastFrame, lastBin, binWindow, lastYMove, spectrogramData)
    {
        //console.log(lastFrame, lastBin);
        const numFrames = spectrogramData.length;
        const numBins = spectrogramData[0].length;

        let frame = lastFrame;

        let binWindowStart = Math.max((lastYMove<0)?lastBin+1:lastBin-binWindow, 0);
        let binWindowStop  = Math.min((lastYMove>0)?lastBin-1:lastBin+binWindow, numBins-1);

        //console.log(binWindowStart, binWindowStop);

        let maxFrame = lastFrame;
        let maxBin   = binWindowStart;
        let maxValue = spectrogramData[maxFrame][maxBin];

        for(let j=binWindowStart; j<=binWindowStop; j++) if(spectrogramData[lastFrame][j] > maxValue && j!=lastBin) {maxValue=spectrogramData[lastFrame][j]; maxBin=j;}

        if(lastFrame == numFrames-1) return {frame:maxFrame, bin:maxBin, value:maxValue, lastYMove:(maxFrame==lastFrame)?maxBin-lastBin:0};
        
        binWindowStart = Math.max(lastBin-binWindow, 0);
        binWindowStop  = Math.min(lastBin+binWindow, numBins-1);

        for(let j=binWindowStart; j<=binWindowStop; j++) if(spectrogramData[lastFrame+1][j] > maxValue) {maxValue=spectrogramData[lastFrame+1][j]; maxFrame=lastFrame+1; maxBin=j;}

        return {frame:maxFrame, bin:maxBin, value:maxValue, lastYMove:(maxFrame==lastFrame)?maxBin-lastBin:0};
    }

    let rightPath = [];
    let leftPath = [];
    let maxF_10 = startBin;
    let minF_10 = startBin;
    let right_10 = startFrame;
    let right_10_freq_bin = startBin;
    let left_10 = startFrame;
    let left_10_freq_bin = startBin;
    //for(let i=startFrame; i<numFrames; i++)
    let nextPoint = {frame:startFrame, bin:startBin, value:value, lastYMove:0};
    
    for(let maxPoints=5; maxPoints>0; maxPoints--)
    {
        //console.log(nextPoint);
        nextPoint = detectRidge(nextPoint.frame, nextPoint.bin, binWindow, nextPoint.lastYMove, spectrogramData);
        value = Math.max(nextPoint.value, value);
        if(nextPoint.value < Math.max(value*0.05, magNoiseThreshold) || nextPoint.frame==numFrames-1)
        {
            right_10 = nextPoint.frame;
            right_10_freq_bin = nextPoint.bin;
            break;
        }
        rightPath.push({bin:nextPoint.bin, frame:nextPoint.frame, value:nextPoint.value});
        maxF_10 = Math.max(maxF_10, nextPoint.value);
        minF_10 = Math.min(minF_10, nextPoint.value);
        //console.log(nextPoint);
        //break;
    }

    return {
        leftFrame:left_10, rightFrame:right_10,
        minBin: minF_10, maxBin: maxF_10,

        left:left_10, right:right_10,
        minFreq_10: minF_10, maxFreq_10: maxF_10,
        left_10:left_10, right_10: right_10,
        left_10_freq:left_10_freq_bin, right_10_freq:right_10_freq_bin,
        leftPath:leftPath, rightPath:rightPath };
}
