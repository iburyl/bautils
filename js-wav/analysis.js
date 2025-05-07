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
            if(magnitude[j] > searchFreqPeak.value   ) searchFreqPeak    = {value:magnitude[j], frame:count, bin:j};
        }

        spectrogramData.push(magnitude);
        peakTime.push(frameBoundedPeak);
        searchPeakTime.push(frameHighPeak);

        minInTime = (i == start)?frameBoundedPeak:Math.min(minInTime, frameBoundedPeak);
        maxInTime = (i == start)?frameBoundedPeak:Math.max(maxInTime, frameBoundedPeak);
        count++;
    }

    let sortedSearchPeakTime = searchPeakTime.toSorted((a, b) => a - b);

    let quamntiles = [];
    for(let i=0; i<=10; i++)
    {
        quamntiles[i] = sortedSearchPeakTime[ Math.round(i/10 * (sortedSearchPeakTime.length - 1)) ];
    }
    let callThreshold = sortedSearchPeakTime[ Math.round(0.5 * (sortedSearchPeakTime.length - 1)) ] * 10;

    let foundCalls = [];
    let callCount = 0;
    let minWindowSize = 20;
    let previous = false;
    let currentWindowSize = minWindowSize;
    const secPerFrame = signalWindow.duration / searchPeakTime.length;
    let expMovingAverage = searchPeakTime[0];
    const expMovingAverageCoeff = 0.2;
    for(let i=0; i<searchPeakTime.length; i++)
    {
        expMovingAverage = expMovingAverage * (1-expMovingAverageCoeff) + searchPeakTime[i] * expMovingAverageCoeff;
        let current = expMovingAverage > callThreshold;
        if(currentWindowSize < minWindowSize) {currentWindowSize++; continue;}

        if(!previous && current)
        {
            currentWindowSize = 1;
            callCount++;
        }
        else if(previous && current)
        {
            currentWindowSize++;
        }
        else if(previous && !current)
        {
            foundCalls.push([signalWindow.start + (i-currentWindowSize) * secPerFrame, signalWindow.start + i * secPerFrame, currentWindowSize]);
            currentWindowSize = 1;
        }
        else if(!previous && !current)
        {
            currentWindowSize++;
        }

        previous = current;
    }
    console.log(callCount);
    console.log(foundCalls);


    function getBox(peakStat, sequence, spectrogramData, lowBin, upperBin) {
        let startFrame = peakStat.frame;
        let startBin = peakStat.bin;
        let value = peakStat.value;

        const numFrames = sequence.length;
        const numBins   = spectrogramData[0].length;

        let binWindow=0;
        for(let j=startBin; j<upperBin; j++) if(spectrogramData[startFrame][j] < value*0.1) { binWindow += j-startBin; break; }
        for(let j=startBin; j>=lowBin; j--) if(spectrogramData[startFrame][j] < value*0.1) { binWindow += startBin-j; break; }

        function detectRidge(frame, lastBin, binWindow, numBins, spectrogramData)
        {
            let binWindowStart = Math.max(lastBin-binWindow, 0);
            let binWindowStop  = Math.min(lastBin+binWindow, numBins);

            let inFramePeakBin = binWindowStart;
            let inFramePeakValue = spectrogramData[frame][inFramePeakBin];
            for(let j=binWindowStart; j<binWindowStop; j++) if(spectrogramData[frame][j] > inFramePeakValue) {inFramePeakValue=spectrogramData[frame][j]; inFramePeakBin=j;}

            return {peakBin:inFramePeakBin, peakValue:inFramePeakValue};
        }

        let right_10;
        let right_10_freq_bin;
        let left_10;
        let left_10_freq_bin;
        let lastBin = startBin;
        for(let i=startFrame; i<numFrames; i++)
        {
            const {peakBin, peakValue} = detectRidge(i, lastBin, binWindow, numBins, spectrogramData);
            lastBin = peakBin;
            if(peakValue < value*0.05 || i==numFrames-1)
            {
                right_10 = i;
                right_10_freq_bin = peakBin;
                break;
            }
        }
        lastBin = startBin;
        for(let i=startFrame; i>=0; i--)
        {
            const {peakBin, peakValue} = detectRidge(i, lastBin, binWindow, numBins, spectrogramData);
            lastBin = peakBin;
            if(peakValue < value*0.05 || i==0)
            {
                left_10 = i;
                left_10_freq_bin = peakBin;
                break;
            }
        }

        function findNextPeakFrame(leftFrame, rightFrame, peakBin, numFrames, spectrogramData)
        {
            let skip = rightFrame - leftFrame;
            if(rightFrame + skip >= numFrames) return -1;
            let noisePeak = spectrogramData[rightFrame+1][peakBin];
            for(let i=rightFrame+1; i<rightFrame + skip; i++) noisePeak = Math.max(noisePeak, spectrogramData[i][peakBin]);

            for(let i=rightFrame + skip; i<numFrames; i++) if(spectrogramData[i][peakBin] > noisePeak * 3) return i;
            return -1;
        }

        let nextPeakFrame = findNextPeakFrame(left_10, right_10, startBin, numFrames, spectrogramData);

        let len = right_10 - left_10;
        if( len < numFrames / 20 ) len = Math.ceil(numFrames / 100);
        let leftBound = Math.max(0, left_10 - len*3);
        let rightBound = Math.min(sequence.length-1, right_10 + len*3);
        
        return {left:leftBound, right:rightBound, left_10:left_10, right_10: right_10, left_10_freq:left_10_freq_bin, right_10_freq:right_10_freq_bin, next_peak: nextPeakFrame};
    }

    searchFreqPeak.box    = getBox(searchFreqPeak, searchPeakTime, spectrogramData, searchFirstBin, searchLastBin); 
    
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
        peak: searchFreqPeak
    };
}
