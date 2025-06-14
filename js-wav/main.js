"use strict";

async function loadFile()
{
    const file = window.sharedFile;
    if (!file) {
        alert('Please select a WAV file first');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();

        let {audioContext, info} = getAudioContext(arrayBuffer);
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        window.sharedAudioBuffer = audioBuffer;
        window.sharedAudioInfo   = info;

        fireNewAudioEvent();
    } 
    catch (error) {
        console.error('Error processing audio:');
        console.error(error);
        alert('Error processing audio file');
    }
}

function updateMainImage()
{
    const infoDiv = document.getElementById('info');
    const info = window.sharedAudioInfo;
    const file = window.sharedFile;
    const ctx = window.ctx;

    if(window.sharedData) {
        const {specData, timeData, freqData} = window.sharedData;

        const {image, specCanvasWindow} = drawSpectrogram(specData, timeData, freqData, window.sharedSignalWindow, params.main.minE.read(), ctx);

        window.sharedMainImage = image;
        window.sharedSpecCanvasWindow = specCanvasWindow;

        let summary = '<table>';
        summary += tableLine('Source:', file.name);
        if(info.duration) summary += tableLine('Duration:', info.duration.toFixed(2) + 's');
        if(info.sampleRate) summary += tableLine('Sampling rate:', (info.sampleRate/1000).toFixed(0) + 'KHz');
        if(info.dataFormat) summary += tableLine('Data format:', info.dataFormat);
        if(info.bitsPerSample) summary += tableLine('Bits per sample:', info.bitsPerSample);
        if(info.numChannels) summary += tableLine('Channels:', info.numChannels);
        if(info.guan)
        {
            summary += '<tr><td colspan=2><center>GUANO</center></td></tr>';
            info.guan.forEach((value,key) => {
                summary += tableLine(key, value);
            })

        }
        if(info.ixml)
        {
            summary += '<tr><td colspan=2><center>iXML</center></td></tr>';
            info.ixml.forEach((value,key) => {
                summary += tableLine(key, value);
            })

        }
        summary += '</table>';
    
        infoDiv.innerHTML = summary;
    }
}

function chiSquareTest(observed, expected, stddev) {
    // Calculate chi-square statistic
    let chiSquare = 0;
    for (let i = 0; i < observed.length; i++) {
        const normalizedDiff = Math.pow((observed[i] - expected[i]) / stddev[i], 2);
        chiSquare += normalizedDiff;
    }
    return chiSquare;
}

function processCharacteristic(char) {
    if (!char || !Array.isArray(char.stddev)) {
        return null;
    }
    return {
        mean: char.mean !== undefined ? char.mean : (char.stddev[0] + char.stddev[1]) / 2,
        stddev: Math.abs(char.stddev[0] - char.stddev[1]) / 2,
        range: Array.isArray(char.range) ? char.range : char.stddev
    };
}

function calculateSpeciesMatch(peakData, species, binToKHz, framesPerMillisec, slopeCoeff) {
    // Check if peakData and its required properties exist
    if (!peakData || !peakData.box || 
        !peakData.box.characteristicFreqPoint || !peakData.box.maxMagPoint || 
        !peakData.box.maxFreqPoint || !peakData.box.minFreqPoint) {
        return null;
    }

    // Collect observed values
    const observed = [
        (peakData.box.rightFrame - peakData.box.leftFrame) * framesPerMillisec, // Duration
        peakData.box.characteristicFreqPoint.bin * binToKHz, // Fc
        peakData.box.maxMagPoint.bin * binToKHz, // FME
        peakData.box.maxFreqPoint.bin * binToKHz, // Fmax
        peakData.box.minFreqPoint.bin * binToKHz, // Fmin
        Math.abs(peakData.box.upperSlope * slopeCoeff), // Upper slope
        Math.abs(peakData.box.lowerSlope * slopeCoeff), // Lower slope
        Math.abs(peakData.box.totalSlope * slopeCoeff)  // Total slope
    ];

    // Get characteristics using shared processing logic
    const characteristics = [
        species.dur,
        species.fc,
        species.fmaxE,
        species.fhi,
        species.flo,
        species.uppr_slope,
        species.lwr_slope,
        species.domnt_slope
    ].map(processCharacteristic);

    // Filter out undefined values
    const validIndices = characteristics.map((char, i) => char !== null ? i : -1).filter(i => i !== -1);
    const validObserved = validIndices.map(i => observed[i]);
    const validExpected = validIndices.map(i => characteristics[i].mean);
    const validStddev = validIndices.map(i => characteristics[i].stddev);

    console.log(validObserved, validExpected, validStddev);
    
    if (validObserved.length === 0) {
        return null;
    }

    const chiSquare = chiSquareTest(validObserved, validExpected, validStddev);
    const degreesOfFreedom = validObserved.length - 1;
    const pValue = Math.exp(-chiSquare / 2) * Math.pow(chiSquare, degreesOfFreedom / 2 - 1);

    console.log(chiSquare, degreesOfFreedom, pValue);

    return {
        species: species,
        chiSquare: chiSquare,
        pValue: pValue,
        degreesOfFreedom: degreesOfFreedom
    };
}

function updatePeakOverlay()
{
    const peakStatsDiv = document.getElementById('peak_stats');

    if(window.sharedData) {
        const signalWindow = window.sharedSignalWindow;
        const sampleRate = signalWindow.sampleRate;
        const specCanvasWindow = window.sharedSpecCanvasWindow;
        const image = window.sharedMainImage;
        const ctx = window.ctx;

        const {specData, timeData, freqData} = window.sharedData;

        const peak = calculatePeak(sampleRate, specData.data, freqData.data);

        const {overlayImage} = drawPeaksOverlay([peak],
            getSignalWindowMapping(sampleRate, specData.data.length, specData.data[0].length, signalWindow), specCanvasWindow, image, ctx, specData);

        window.sharedPeakImage = overlayImage;

        function addStats(name, div, peakData, signalWindow, numFrames, numBins)
        {
            const binToKHz = 1 / numBins * signalWindow.sampleRate / 1000;
            const framesPerSec = signalWindow.duration / numFrames;
            const framesPerMillisec = signalWindow.duration / numFrames * 1000;

            const slopeCoeff = binToKHz / framesPerSec / 1000;
            
            // Get selected species data for comparison
            function getSelectedSpeciesData() {
                const speciesSourceSelect = document.getElementById('species_source_values');
                const speciesListSelect = document.getElementById('species_values');
                
                if (!speciesSourceSelect || !speciesListSelect || 
                    !speciesSourceSelect.value || !speciesListSelect.value) {
                    return null;
                }
                
                const sourceKey = speciesSourceSelect.value;
                const speciesCode = speciesListSelect.value;
                
                if (window.speciesData && window.speciesData[sourceKey] && 
                    window.speciesData[sourceKey].species) {
                    
                    return window.speciesData[sourceKey].species.find(
                        species => (species.code === speciesCode || species.species === speciesCode)
                    );
                }
                
                return null;
            }
            
            const selectedSpecies = getSelectedSpeciesData();
            
            // Calculate chi-square for selected species
            let chiSquareResult = '';
            if (selectedSpecies) {
                const match = calculateSpeciesMatch(peakData, selectedSpecies, binToKHz, framesPerMillisec, slopeCoeff);
                if (match) {
                    chiSquareResult = 
                        tableSubtitle('Chi-Square Test', 'χ²', 'p-value', '') + 
                        tableLine('', match.chiSquare.toFixed(2), match.pValue.toFixed(4), '');
                }
            }
            
            function getBar(value, compare, unit = '')
            {
                if (!compare || !compare.range || compare.range.length < 2) {
                    return '';
                }
                
                let min = Math.min(compare.range[0], value);
                const max = Math.max(compare.range[1], value);
                const diff = (max - min)*1.2;
                min -= (max - min)*0.1;
                
                if (diff === 0) return '';

                const range_x = [Math.round((compare.range[0] - min)/diff*120), Math.round((compare.range[1] - min)/diff*120)];
                const stddev_x = [Math.round((compare.mean - compare.stddev - min)/diff*120), Math.round((compare.mean + compare.stddev - min)/diff*120)];
                const value_x = Math.round((value - min)/diff*120)-1;

                let tooltipText = `Observed: ${value.toFixed(2)}${unit}\n`;
                tooltipText += `Reference Species:\n`;
                tooltipText += `Mean: ${compare.mean.toFixed(2)}${unit}\n`;
                tooltipText += `StdDev Range: ${(compare.mean-compare.stddev).toFixed(2)} - ${(compare.mean+compare.stddev).toFixed(2)}${unit}\n`;
                tooltipText += `Full Range: ${compare.range[0].toFixed(2)} - ${compare.range[1].toFixed(2)}${unit}`;

                return '<svg width="120" height="10">' +
                      '<title>' + tooltipText + '</title>' +
                      '<rect x="0" y="0" width="120" height="10" fill="#f96" /> ' + // background
                      '<rect x="'+range_x[0]+'" y="0" width="'+(range_x[1]-range_x[0])+'" height="10" fill="#ff9" /> ' + // Full range
                      '<rect x="'+stddev_x[0]+'" y="0" width="'+(stddev_x[1]-stddev_x[0])+'" height="10" fill="#9f6" /> ' + // Mean ± SD
                      '<rect x="'+value_x+'" y="0" width="2" height="10" fill="#f00" /> '  + // Current observation
                    '</svg>';
            }
            
            function addPoint(name, point, freqCompare = null, slopeCompare = null)
            {
                const freq = point.bin * binToKHz;
                const slope = point.slope * slopeCoeff;
                const freq_bar = freqCompare ? '<br />'+getBar(freq, freqCompare, ' kHz') : '';
                const slope_bar = slopeCompare ? '<br />'+getBar(Math.abs(slope), slopeCompare, ' kHz/ms') : '';

                return tableLine(name, 
                    freq.toFixed(1) + ' kHz' + freq_bar, 
                    (signalWindow.start + point.frame * framesPerSec).toFixed(4) + ' s', 
                    slope.toFixed(3) + ' kHz/ms' + slope_bar);
            }
            
            // Create comparison data objects if species is selected
            let durCompare = null, fcCompare = null, fmeCompare = null, fmaxCompare = null, fminCompare = null;
            let upperSlopeCompare = null, lowerSlopeCompare = null, totalSlopeCompare = null, fcSlopeCompare = null;
            
            if (selectedSpecies) {
                // Duration comparisons
                if (selectedSpecies.dur) {
                    durCompare = processCharacteristic(selectedSpecies.dur);
                }

                // Frequency comparisons
                if (selectedSpecies.fc) {
                    fcCompare = processCharacteristic(selectedSpecies.fc);
                }
                if (selectedSpecies.fmaxE) {
                    fmeCompare = processCharacteristic(selectedSpecies.fmaxE);
                }
                if (selectedSpecies.fhi) {
                    fmaxCompare = processCharacteristic(selectedSpecies.fhi);
                }
                if (selectedSpecies.flo) {
                    fminCompare = processCharacteristic(selectedSpecies.flo);
                }
                
                // Slope comparisons (convert from kHz/ms to match our units)
                if (selectedSpecies.uppr_slope) {
                    upperSlopeCompare = processCharacteristic(selectedSpecies.uppr_slope);
                }
                if (selectedSpecies.lwr_slope) {
                    lowerSlopeCompare = processCharacteristic(selectedSpecies.lwr_slope);
                }
                if (selectedSpecies.domnt_slope) {
                    totalSlopeCompare = processCharacteristic(selectedSpecies.domnt_slope);
                }
                if (selectedSpecies.slope_fc) {
                    fcSlopeCompare = processCharacteristic(selectedSpecies.slope_fc);
                }
            }
            
            div.innerHTML =
                '<table>' +
                
                tableSubtitle('Timing', 'Start', 'Stop', 'Duration') +
                tableLine('',  
                    (signalWindow.start + peakData.box.leftFrame * framesPerSec).toFixed(4) + ' s', 
                    (signalWindow.start + peakData.box.rightFrame * framesPerSec).toFixed(4) + ' s', 
                    ((peakData.box.rightFrame - peakData.box.leftFrame) * framesPerMillisec).toFixed(1) + ' ms' + (durCompare ? '<br />'+getBar(Math.abs(peakData.box.rightFrame - peakData.box.leftFrame) * framesPerMillisec, durCompare, ' ms') : '')) + 

                tableSubtitle('Key points', 'Frequency', 'Time', 'Slope') +
                addPoint('Fc (characteristic frequency)', peakData.box.characteristicFreqPoint, fcCompare, fcSlopeCompare) + 
                addPoint('FME (frequency of most energy)', peakData.box.maxMagPoint, fmeCompare) + 
                addPoint('Fmax (highest frequency)', peakData.box.maxFreqPoint, fmaxCompare) + 
                addPoint('Fmin (lowest frequency)', peakData.box.minFreqPoint, fminCompare) + 
                addPoint('Fknee (knee frequency)', peakData.box.kneeFreqPoint) + 

                tableLine('Fmean (mean frequency)', (peakData.box.meanFreq * binToKHz).toFixed(1) + ' kHz', '', '') + 

                tableSubtitle('Key slopes', 'Upper', 'Lower', 'Total') +  
                tableLine('',  
                    (peakData.box.upperSlope * slopeCoeff).toFixed(3) + ' kHz/ms' + (upperSlopeCompare ? '<br />'+getBar(Math.abs(peakData.box.upperSlope * slopeCoeff), upperSlopeCompare, ' kHz/ms') : ''), 
                    (peakData.box.lowerSlope * slopeCoeff).toFixed(3) + ' kHz/ms' + (lowerSlopeCompare ? '<br />'+getBar(Math.abs(peakData.box.lowerSlope * slopeCoeff), lowerSlopeCompare, ' kHz/ms') : ''), 
                    (peakData.box.totalSlope * slopeCoeff).toFixed(3) + ' kHz/ms' + (totalSlopeCompare ? '<br />'+getBar(Math.abs(peakData.box.totalSlope * slopeCoeff), totalSlopeCompare, ' kHz/ms') : '')) +    

                tableSubtitle('Magnitude vs. peak', 'Left', 'Right', 'Estimated noise') +
                tableLine('',  
                    (peakData.box.leftMagnitudeDrop).toFixed(1) + ' dB', 
                    (peakData.box.rightMagnitudeDrop).toFixed(1) + ' dB', 
                    (peakData.box.noiseThreshold).toFixed(1) + ' dB') + 
                chiSquareResult + // Add chi-square test results
                '</table>';

            }
        
        addStats('Found peak', peakStatsDiv, peak, window.sharedSignalWindow, window.sharedData.timeData.data.length, window.sharedData.specData.data[0].length);
    }
}

function showCurrentImage()
{
    const peakTab = document.getElementById('peak-stats');
    const ctx = window.ctx;

    if(peakTab.classList.contains('active'))
    {
        window.sharedImage = window.sharedPeakImage;
    }
    else
    {
        window.sharedImage = window.sharedMainImage;
    }
    ctx.putImageData(window.sharedImage, 0, 0);
}

function showFile()
{
    const peakTab = document.getElementById('peak-stats');
    const ctx = window.ctx;
    const peakStatsDiv = document.getElementById('peak_stats');
    const audioElement = document.getElementById('audioPlayer');

    //const file = fileInput.files[0];
    const file = window.sharedFile;
    if (!file) {
        alert('Please select a WAV file first');
        return;
    }

    try {
        const audioBuffer = window.sharedAudioBuffer;

        const sampleRate = audioBuffer.sampleRate;
        const duration   = audioBuffer.duration;

        const {signalWindow, params} = getUserParams(sampleRate, duration);
        window.sharedSignalWindow = signalWindow;

        // Generate spectrogram
        console.time('generateSpectrogram');
        window.sharedData = generateSpectrogram(params.fftSize, params.hopSize, signalWindow, params, audioBuffer); // Optimized
        console.timeEnd('generateSpectrogram');

        console.time('updateMainImage');
        updateMainImage();
        console.timeEnd('updateMainImage');
        
        console.time('updatePeakOverlay');
        updatePeakOverlay();
        console.timeEnd('updatePeakOverlay');

        showCurrentImage();

        audioElement.currentTime = signalWindow.start;
    } 
    catch (error) {
        console.error('Error processing audio:');
        console.error(error);
        alert('Error processing audio file');
    }
}
