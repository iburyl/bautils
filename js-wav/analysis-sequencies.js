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

