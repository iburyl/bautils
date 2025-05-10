"use strict";

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
High18 (highest frequency, 18 dBabove peak), and High6 (highest frequency, 6 dB above peak).

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

function generateSpectrogram(fftSize, hopSize, signalWindow, params, audioBuffer, audioContext) {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = signalWindow.sampleRate;
    const kaiserBeta = params.kaiserBeta;

    // Process audio data in chunks
    let spectrogramData = [];
    let peakTime = [];
    let searchPeakTime = [];
    let maxSpectrogramValue = 0;

    let start = Math.floor(signalWindow.start * sampleRate);
    let stop  = Math.min(Math.floor((signalWindow.start + signalWindow.duration) * sampleRate) + fftSize, channelData.length);

    const beta = kaiserBeta;
    const window = (beta>=0)?kaiserWindow(fftSize, beta):[];

    const numBins = fftSize+1;
    const binsPerKHz = numBins/sampleRate*1000;        
    const firstBin = Math.floor(signalWindow.minFreq * binsPerKHz);
    const lastBin = Math.min(firstBin + Math.floor((signalWindow.maxFreq - signalWindow.minFreq) * binsPerKHz), numBins);

    let minInTime;
    let maxInTime;

    let peakFreq = new Array(numBins);
    let count = 0;

    let searchFreqPeak={value:0, frame:0, bin:0};

    let searchFirstBin = Math.min(Math.floor(binsPerKHz * params.peakMinFreq), fftSize);
    let searchLastBin = Math.min(searchFirstBin + Math.floor((params.peakMaxFreq - params.peakMinFreq) * binsPerKHz), numBins);

    for (let i = start; i < stop; i += hopSize) {
        const chunk = channelData.slice(i, i + fftSize);
        if (chunk.length < fftSize) break;

        if(beta>=0) for(let j = 0; j < fftSize; j++) chunk[j] *= window[j];

        const f = new FFT(fftSize);
        const out = f.createComplexArray();
        f.realTransform(out, chunk);

        const magnitude = new Array(numBins);

        let frameLowPeak = 0;
        let frameBoundedPeak = 0;
        let frameHighPeak = 0;

        for(let j=0;j<fftSize;j++)
        {
            magnitude[j] = Math.sqrt(out[j*2]*out[j*2] + out[j*2+1]*out[j*2+1]);

            peakFreq[j] = (i == start)?magnitude[j]:Math.max(magnitude[j], peakFreq[j]);
        }

        for(let j=firstBin;j<lastBin;j++)
        {
            frameBoundedPeak = Math.max(magnitude[j], frameBoundedPeak);
            //frameBoundedPeak += magnitude[j] / (lastBin-firstBin);
            maxSpectrogramValue = Math.max(magnitude[j], maxSpectrogramValue);
        }

        for(let j=searchFirstBin;j<searchLastBin;j++)
        {
            frameHighPeak = Math.max(magnitude[j], frameHighPeak);
            if(magnitude[j] > searchFreqPeak.value) searchFreqPeak = {value:magnitude[j], frame:count, bin:j};
        }

        spectrogramData.push(magnitude);
        peakTime.push(frameBoundedPeak);
        searchPeakTime.push(frameHighPeak);

        minInTime = (i == start)?frameBoundedPeak:Math.min(minInTime, frameBoundedPeak);
        maxInTime = (i == start)?frameBoundedPeak:Math.max(maxInTime, frameBoundedPeak);
        count++;
    }

    let foundCalls = searchForPeaks2(searchPeakTime, spectrogramData, searchFirstBin, searchLastBin);

    searchFreqPeak.box = getBox(searchFreqPeak, spectrogramData, searchFirstBin, searchLastBin); 
    
    let minInFreq;
    let maxInFreq;

    for(let j=firstBin;j<lastBin;j++)
    {
        minInFreq = (j==firstBin)?peakFreq[j]:Math.min(minInFreq, peakFreq[j]);
        maxInFreq = (j==firstBin)?peakFreq[j]:Math.max(maxInFreq, peakFreq[j]);
    }

    return {
        specData:{data: spectrogramData, maxValue: maxSpectrogramValue},
        timeData:{data: peakTime, minValue: minInTime, maxValue: maxInTime},
        freqData:{data: peakFreq, minValue: minInFreq, maxValue: maxInFreq},
        peak: searchFreqPeak,
        foundPeaks: foundCalls
    };
}

function searchForPeaks2(searchPeakTime, spectrogramData, lowBin, upperBin) {
    let sortedSearchPeakTime = searchPeakTime.toSorted((a, b) => a - b);

    let quamntiles = [];
    for(let i=0; i<=10; i++)
    {
        quamntiles[i] = sortedSearchPeakTime[ Math.round(i/10 * (sortedSearchPeakTime.length - 1)) ];
    }
    let magNoiseThreshold = sortedSearchPeakTime[ Math.round(0.5 * (sortedSearchPeakTime.length - 1)) ] * 10;

    let foundCalls = [];
    const minWindowSize = 20;
    let expMovingAverage = searchPeakTime[0];
    const expMovingAverageCoeff = 0.2;

    for(let i=0; i<searchPeakTime.length; i++)
    {
        expMovingAverage = expMovingAverage * (1-expMovingAverageCoeff) + searchPeakTime[i] * expMovingAverageCoeff;
        let current = expMovingAverage > magNoiseThreshold;
        if(!current) continue;

        let framePeakValue = spectrogramData[i][lowBin];
        let framePeakBin = lowBin;
        for(let j=lowBin; j<upperBin; j++) if(spectrogramData[i][j] > framePeakValue) {framePeakBin=j; framePeakValue=spectrogramData[i][j];};

        let box = getBox2({frame:i, bin:framePeakBin, value:framePeakValue}, spectrogramData, lowBin, upperBin, foundCalls[foundCalls.length-1], magNoiseThreshold);

        if(box.minFreq_10 < lowBin) continue;
        
        box.start = box.left_10;
        box.stop  = box.right_10;    
        foundCalls.push(box);

        i = box.stop+1;
    }

    return foundCalls;
}

/*
function searchForPeaks(searchPeakTime, spectrogramData, lowBin, upperBin) {
    let sortedSearchPeakTime = searchPeakTime.toSorted((a, b) => a - b);

    let quamntiles = [];
    for(let i=0; i<=10; i++)
    {
        quamntiles[i] = sortedSearchPeakTime[ Math.round(i/10 * (sortedSearchPeakTime.length - 1)) ];
    }
    let magNoiseThreshold = sortedSearchPeakTime[ Math.round(0.5 * (sortedSearchPeakTime.length - 1)) ] * 10;

    let foundCalls = [];
    let callCount = 0;
    const minWindowSize = 20;
    let previous = false;
    let currentWindowSize = minWindowSize;
    let expMovingAverage = searchPeakTime[0];
    const expMovingAverageCoeff = 0.2;
    for(let i=0; i<searchPeakTime.length; i++)
    {
        expMovingAverage = expMovingAverage * (1-expMovingAverageCoeff) + searchPeakTime[i] * expMovingAverageCoeff;
        let current = expMovingAverage > magNoiseThreshold;
        if(currentWindowSize < minWindowSize) {currentWindowSize++; continue;}

        if(previous == current)
        {
            currentWindowSize++;
        }
        else if(!previous && current)
        {
            currentWindowSize = 1;
            callCount++;
        }
        else if(previous && !current)
        {
            foundCalls.push({start: i-currentWindowSize, stop: i, duration: currentWindowSize});
            currentWindowSize = 1;
        }

        previous = current;
    }

    return foundCalls;
}
*/

function getBox(peakStat, spectrogramData, lowBin, upperBin, prevBox, magNoiseThreshold) {
    let startFrame = peakStat.frame;
    let startBin = peakStat.bin;
    let value = peakStat.value;
    magNoiseThreshold = (magNoiseThreshold)?magNoiseThreshold:0;

    const numFrames = spectrogramData.length;
    const numBins   = spectrogramData[0].length;

    //let binWindow=Math.ceil((upperBin-lowBin)/20);
    //let binWindow=Math.ceil((upperBin-lowBin)/10);
    //let binWindow=Math.min(Math.ceil((upperBin-lowBin)/10),5);
    let binWindow=2;
    //for(let j=startBin; j<upperBin; j++) if(spectrogramData[startFrame][j] < value*0.1) { binWindow += j-startBin; break; }
    //for(let j=startBin; j>=lowBin; j--) if(spectrogramData[startFrame][j] < value*0.1) { binWindow += startBin-j; break; }
    //console.log(binWindow);

    function detectRidge(frame, lastBin, binWindow, numBins, spectrogramData)
    {
        let binWindowStart = Math.max(lastBin-binWindow, 0);
        let binWindowStop  = Math.min(lastBin+binWindow, numBins);

        let inFramePeakBin = binWindowStart;
        let inFramePeakValue = spectrogramData[frame][inFramePeakBin];
        for(let j=binWindowStart; j<binWindowStop; j++) if(spectrogramData[frame][j] > inFramePeakValue) {inFramePeakValue=spectrogramData[frame][j]; inFramePeakBin=j;}
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

    let len = right_10 - left_10;
    if( len < numFrames / 20 ) len = Math.ceil(numFrames / 100);
    let leftBound = Math.max(0, left_10 - len*3);
    let rightBound = Math.min(numFrames-1, right_10 + len*3);

    return {
        left:leftBound, right:rightBound,
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
        console.log(lastFrame, lastBin);
        const numFrames = spectrogramData.length;
        const numBins = spectrogramData[0].length;

        let frame = lastFrame;

        let binWindowStart = Math.max((lastYMove<0)?lastBin+1:lastBin-binWindow, 0);
        let binWindowStop  = Math.min((lastYMove>0)?lastBin-1:lastBin+binWindow, numBins-1);

        console.log(binWindowStart, binWindowStop);

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
        console.log(nextPoint);
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

    /*
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
    */

    let len = right_10 - left_10;
    if( len < numFrames / 20 ) len = Math.ceil(numFrames / 100);
    let leftBound = Math.max(0, left_10 - len*3);
    let rightBound = Math.min(numFrames-1, right_10 + len*3);

    return {
        left:leftBound, right:rightBound,
        minFreq_10: minF_10, maxFreq_10: maxF_10,
        left_10:left_10, right_10: right_10,
        left_10_freq:left_10_freq_bin, right_10_freq:right_10_freq_bin,
        leftPath:leftPath, rightPath:rightPath };
}
