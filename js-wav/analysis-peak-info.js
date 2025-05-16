/* Joseph M. Szewczak, 2010
The benefits of full-spectrum data for analyzing bat echolocation calls.
https://sonobat.com/wp-content/uploads/2014/02/presentation.pdf

Oisin Mac Aodha, et. al., 2018    
Bat detective-Deep learning tools for bat acoustic signal detection
https://pmc.ncbi.nlm.nih.gov/articles/PMC5843167/

Robert M. R. Barclay, et. al., 1999
Variation in the echolocation calls of the hoary bat (Lasiurus cinereus): Influence of body size, habitat structure, and geographic location
https://www.researchgate.net/publication/249542306_Variation_in_the_echolocation_calls_of_the_hoary_bat_Lasiurus_cinereus_Influence_of_body_size_habitat_structure_and_geographic_location

We used the frequency with the highest intensity as a reference and determined higher and lower frequencies of calls at specific intensities
below the peak (Fullard et al. 1993). This eliminates the subjectivity involved in attempts to determine the minimum and maximum
frequencies in a call, which are often difficult to measure owing to background noise.
For each call, we measured duration in milliseconds, peak frequency in kilohertz (spectral peak of highest inten-sity),
Low18 (lowest frequency, 18 dB below peak), Low6 (lowest frequency, 6 dB below peak),
High18 (highest frequency, 18 dB above peak), and High6 (highest frequency, 6 dB above peak).

Bat Echolocation Research. A handbook for planning and conducting acoustic studies
https://www.batcon.org/wp-content/uploads/2020/09/Bat_Echolocation_Research_2nd_Ed_20200918.pdf
Second Edition

Table 4-1. Commonly measured parameters of individual bat echolocation calls and their abbreviations.

Fc - Characteristic frequency, i.e. the frequency at the right hand end of the portion of the call
with the lowest absolute slope (the Body).
Sc - Characteristic Slope, or the slope of the body of the call.
Fmax = Highest frequency recorded in the call.
Fmin = Lowest frequency recorded in the call.
Fmean = Mean frequency of the call, found by dividing area under the call by the duration.
FME = Frequency of most energy, also called peak frequency, i.e. the frequency of the call with the
greatest amplitude.
S1 = initial slope of the call.
Tc = Time between the start of the call and the point at which Fc is measured (i.e. the right hand
end of the body)
Fk = Frequency of the knee; the body of a call is said to start at the knee, which usually is a point
where dramatic change of slope occurs.
Tk = Time from start if a cakk to the knee
Dur = Time from beggining of a call to its end.
TBC/IPI = Time between calls (also called interpulse interval)

*/

"use strict";

function getBoxStats(peak)
{
    const minMagnitudeDrop = 20 * Math.min(Math.log10(peak.value / peak.box.leftPath.at(-1).value), Math.log10(peak.value / peak.box.rightPath.at(-1).value));
    const noiseThreshold = 20 * Math.log10(peak.value / peak.box.magNoiseThreshold);

    //console.log(peak.box.magNoiseThreshold);

    peak.box.magnitudeDrop = minMagnitudeDrop;
    peak.box.noiseThreshold = noiseThreshold;
    peak.box.left = peak.box.leftFrame;
    peak.box.right = peak.box.rightFrame;
    peak.box.left_freq = peak.box.leftPath.at(-1).bin;
    peak.box.right_freq = peak.box.rightPath.at(-1).bin;
    peak.box.minFreq = peak.box.minBin;
    peak.box.maxFreq = peak.box.maxBin;
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

    if(lastFrame == numFrames-1) return {frame:maxFrame, bin:maxBin, value:maxValue, lastYMove:(maxFrame==lastFrame)?maxBin-lastBin:0};
    
    binWindowStart = Math.max(lastBin-binWindow, 0);
    binWindowStop  = Math.min(lastBin+binWindow, numBins-1);

    for(let j=binWindowStart; j<=binWindowStop; j++) if(spectrogramData[lastFrame+frameDirection][j] > maxValue) {maxValue=spectrogramData[lastFrame+frameDirection][j]; maxFrame=lastFrame+frameDirection; maxBin=j;}

    return {frame:maxFrame, bin:maxBin, value:maxValue, lastYMove:(maxFrame==lastFrame)?maxBin-lastBin:0};
}

function getBox(peakStat, spectrogramData, lowBin, upperBin, magNoiseThreshold) {
    const detectRidge = detectRidgeSlow;
    //const detectRidge = detectRidgeQuick;

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
    let nextPoint = {frame:startFrame, bin:startBin, value:value, lastYMove:0};
    
    let firstYMove;
    
    for(let maxPoints=numFrames; maxPoints>0; maxPoints--)
    {
        nextPoint = detectRidge(nextPoint.frame, nextPoint.bin, binWindow, +1, nextPoint.lastYMove, spectrogramData);
        value = Math.max(nextPoint.value, value);
        if(maxPoints == numBins) firstYMove = nextPoint.lastYMove;
        rightPath.push({bin:nextPoint.bin, frame:nextPoint.frame, value:nextPoint.value});
        maxF = Math.max(maxF, nextPoint.bin);
        minF = Math.min(minF, nextPoint.bin);
        if(nextPoint.value < Math.max(value*magDropCoeff, magNoiseThreshold) || nextPoint.frame==numFrames-1) break;
    }

    nextPoint = {frame:startFrame, bin:startBin, value:value, lastYMove:-firstYMove};

    for(let maxPoints=numFrames; maxPoints>0; maxPoints--)
    {
        nextPoint = detectRidge(nextPoint.frame, nextPoint.bin, binWindow, -1, nextPoint.lastYMove, spectrogramData);
        value = Math.max(nextPoint.value, value);
        if(maxPoints == numBins) firstYMove = nextPoint.lastYMove;
        leftPath.push({bin:nextPoint.bin, frame:nextPoint.frame, value:nextPoint.value});
        maxF = Math.max(maxF, nextPoint.bin);
        minF = Math.min(minF, nextPoint.bin);
        if(nextPoint.value < Math.max(value*magDropCoeff, magNoiseThreshold) || nextPoint.frame==0) break;
    }

    const right = (rightPath.length>0)?rightPath[rightPath.length-1].frame:startFrame;
    const left  = (leftPath.length>0)?leftPath[leftPath.length-1].frame:startFrame;

    return {
        leftFrame:left, rightFrame:right,
        minBin: minF, maxBin: maxF,
        leftPath: leftPath, rightPath: rightPath,
        magNoiseThreshold: magNoiseThreshold };
}
