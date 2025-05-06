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

    console.log(searchFirstBin, params.peakMinFreq, searchLastBin, params.peakMaxFreq);

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

        for(j=0;j<fftSize;j++)
        {
            magnitude[j] = Math.sqrt(out[j*2]*out[j*2] + out[j*2+1]*out[j*2+1]);

            peakFreq[j] = (i == start)?magnitude[j]:Math.max(magnitude[j], peakFreq[j]);
        }

        for(j=firstBin;j<lastBin;j++)
        {
            frameBoundedPeak = Math.max(magnitude[j], frameBoundedPeak);
            //frameBoundedPeak += magnitude[j] / (lastBin-firstBin);
            maxSpectrogramValue = Math.max(magnitude[j], maxSpectrogramValue);
        }

        for(j=searchFirstBin;j<searchLastBin;j++)
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
        let left_10;
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

    for(j=firstBin;j<lastBin;j++)
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
