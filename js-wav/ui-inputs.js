"use strict";

function getInputFPValue(el) { return Number(el.value); }
function fireNewAudioEvent() {
    const event = new CustomEvent("new-audio", {});
    document.dispatchEvent(event);

    fireSignalWindowUpdateEvent();
}
function fireSignalWindowUpdateEvent() {
    const event = new CustomEvent("params-update", {});
    document.dispatchEvent(event);
}

const params = {main:{}, peak:{}, selection:{}};

function getUserParams(sampleRate, duration)
{
    let userStart =    params.main.start.read();
    let userStop  =    params.main.stop.read();
    let userDuration = Math.min(userStop - userStart, duration);
    let userMinFreq =  params.main.minFreq.read();
    let userMaxFreq =  params.main.maxFreq.read();
    let userFreqDiff = userMaxFreq - userMinFreq;

    const fftSize = params.main.fft.read();
    let hopSize   = params.main.hop.read();
    const minE    = params.main.minE.read();
    const kaiserBeta = params.main.kaiserBeta.read();

    let userPeakMinFreq =  params.peak.minFreq.read();
    let userPeakMaxFreq =  (params.peak.maxFreq.value == "")?userMaxFreq:Number(params.peak.maxFreq.value);

    if( userPeakMinFreq > userMaxFreq ) {params.peak.minFreq.value = ""; userPeakMinFreq=0;}
    if( userPeakMaxFreq < userMinFreq ) {params.peak.maxFreq.value = ""; userPeakMaxFreq=userMaxFreq;}

    return {
        signalWindow: {start: userStart, stop: userStop, duration: userDuration, minFreq: userMinFreq, maxFreq: userMaxFreq, freqDiff: userFreqDiff, sampleRate: sampleRate, fullDuration: duration},
        params: {fftSize: fftSize, hopSize: hopSize, minE: minE, kaiserBeta: kaiserBeta, peakMinFreq:userPeakMinFreq, peakMaxFreq: userPeakMaxFreq}
        };
}

function initParam(name, defaultValue, deps, onChange, onRead)
{
    const el = document.getElementById(name);
    el.value = defaultValue

    if(onRead) {el.read = onRead;} else {el.read = () => {return Number(el.value);};}
    //el.myCustomFunction = function () {return el.value;};

    if(Array.isArray(deps)) {
        deps.push(el);
        deps.forEach((dep) => {
            if(dep instanceof Element) {
                dep.addEventListener('change', () =>
                {
                    if( window.sharedAudioBuffer && onChange )
                    {
                        onChange(el, dep);
                    }
                    else
                    {
                        el.value = defaultValue;
                    }
                } );
            }
            if(typeof dep === "string") {
                document.addEventListener(dep, () =>
                {
                    if( window.sharedAudioBuffer && onChange )
                    {
                        if(dep == 'new-audio') el.value = defaultValue;

                        onChange(el, dep);
                    }
                    else
                    {
                        el.value = defaultValue;
                    }
                } );
            }
        } );
    }

    return el;
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('wavFile');
    const mainCanvas = document.getElementById('mainCanvas');

    // Add state for tracking multiple files
    window.sharedFiles = [];
    window.currentFileIndex = -1;

    // Main Tab
    params.main.start  = initParam('start', 0, ['new-audio'], (el) =>
    {
        const duration = window.sharedAudioBuffer.duration;
        const old_value = el.read();
        const new_value = Math.max(0, Math.min(old_value, duration-0.001));
        el.value = new_value;
    });
    params.main.stop   = initParam('stop', '', ['new-audio',params.main.start], (el) =>
    {
        const start = params.main.start.read();
        const duration = window.sharedAudioBuffer.duration;
        if(el.value == '') el.value=duration;
        else
        {
            const old_value = el.read();
            const new_value = Math.max(start+0.001, Math.min(old_value, duration));
            el.value = new_value;
        }
    });
    params.main.minFreq= initParam('min_freq', 0, ['new-audio'], (el) =>
    {
        const maxFreq = window.sharedAudioBuffer.sampleRate / 1000 / 2;
        const old_value = el.read();
        const new_value = Math.max(0, Math.min(old_value, maxFreq-1));
        el.value = new_value;
    });
    params.main.maxFreq= initParam('max_freq', '', ['new-audio',params.main.minFreq], (el) =>
    {
        const minFreq = params.main.minFreq.read();
        const maxFreq = window.sharedAudioBuffer.sampleRate / 1000 / 2;
        if(el.value == '') el.value=maxFreq;
        else
        {
            const old_value = el.read();
            const new_value = Math.max(minFreq+1, Math.min(old_value, maxFreq));
            el.value = new_value;
        }
    });
    params.main.fft    = initParam('fft', '', ['params-update',params.main.start,params.main.stop,params.main.minFreq,params.main.maxFreq], (el, dep) =>
    {
        const sampleRate = window.sharedAudioBuffer.sampleRate;
        const userDuration = params.main.stop.read() - params.main.start.read();
        const userFreqDiff = params.main.maxFreq.read() - params.main.minFreq.read();

        const targetFFT = Math.sqrt((sampleRate*sampleRate * mainCanvas.height / mainCanvas.width * userDuration / userFreqDiff)) / 10;
        const targetFFT2based = Math.pow(2, Math.round(Math.log2(targetFFT)));
        const defaultFFT = Math.max(Math.min(targetFFT2based, 4096), 128);

        if(el !== dep || el.value =='') el.value = defaultFFT;
    } );
    params.main.hop    = initParam('hop', '', ['params-update',params.main.start,params.main.stop,params.main.minFreq,params.main.maxFreq], (el, dep) =>
    {
        const sampleRate = window.sharedAudioBuffer.sampleRate;
        const userDuration = params.main.stop.read() - params.main.start.read();
        let pixelWidth = mainCanvas.width;
        let userPoints = userDuration * sampleRate;

        if(el !== dep || el.value =='') el.value = Math.ceil(userPoints/pixelWidth);
    } );
    params.main.minE   = initParam('min_e', -5);
    params.main.kaiserBeta = initParam('kaiser_beta', 10);

    // Peak Tab
    params.peak.minFreq= initParam('peak_min_freq', '', ['new-audio',params.main.minFreq,params.main.maxFreq], (el, dep) =>
    {
        const userMaxFreq = params.main.maxFreq.read();
        const userMinFreq = params.main.minFreq.read();

        const targetValue = (userMaxFreq>30)?16:1;

        if(el.value =='') el.value = targetValue;

        const currentValue = el.read();

        if(currentValue >= userMaxFreq)
        {
            if( targetValue < userMaxFreq ) el.value = targetValue; else el.value = (userMaxFreq+userMinFreq)/2;
        }        

        if(el == dep)
        {
            updatePeakOverlay();
            showCurrentImage();
        }
    } );
    params.peak.maxFreq      = initParam('peak_max_freq', '', [], (el) => {
        updatePeakOverlay();
        showCurrentImage();
    });
    params.peak.leftMagFall  = initParam('left_mag_fall', '', [], (el) => {
        updatePeakOverlay();
        showCurrentImage();
    });
    params.peak.rightMagFall = initParam('right_mag_fall', '', [], (el) => {
        updatePeakOverlay();
        showCurrentImage();
    });

    params.peak.speciesList = initParam('species_values', '', [], (el) => {
        updatePeakOverlay();
        showCurrentImage();
    });

    params.peak.speciesSource = initParam('species_source_values', '', ['params-update'], (el) => {
        const oldSpeciesValue = params.peak.speciesList.value;
        let hasSameValue = false;
        params.peak.speciesList.value = '';
        
        // Clear existing options
        const speciesListSelect = document.getElementById('species_values');
        speciesListSelect.innerHTML = '<option value=""></option>';
        
        if (el.value !== '' && window.speciesData && window.speciesData[el.value]) {
            const speciesDataSet = window.speciesData[el.value];
            
            // Get current peak data if available
            let matches = [];
            if (window.sharedData && window.sharedSignalWindow) {
                const peakData = calculatePeak(window.sharedSignalWindow.sampleRate, 
                    window.sharedData.specData.data, window.sharedData.freqData.data);
                
                if (peakData) {
                    const binToKHz = 1 / window.sharedData.specData.data[0].length * window.sharedSignalWindow.sampleRate / 1000;
                    const framesPerMillisec = window.sharedSignalWindow.duration / window.sharedData.timeData.data.length * 1000;
                    const framesPerSec = window.sharedSignalWindow.duration / window.sharedData.timeData.data.length;
                    const slopeCoeff = binToKHz / framesPerSec / 1000;

                    // Calculate matches for all species
                    matches = speciesDataSet.species
                        .map(species => calculateSpeciesMatch(peakData, species, binToKHz, framesPerMillisec, slopeCoeff))
                        .filter(match => match !== null)
                        .sort((a, b) => a.chiSquare - b.chiSquare);
                }
            }
            
            // Populate with species from the embedded data
            if (speciesDataSet.species && Array.isArray(speciesDataSet.species)) {
                const speciesToAdd = matches.length > 0 ? 
                    matches.map(match => match.species) : 
                    speciesDataSet.species;

                speciesToAdd.forEach(species => {
                    const option = document.createElement('option');
                    option.value = species.code || species.species;
                    option.textContent = `${species.common_name} (${species.code || species.species})`;
                    speciesListSelect.appendChild(option);

                    if(species.code || species.species == oldSpeciesValue) hasSameValue = true;
                });
            }

            if(!hasSameValue) params.peak.speciesList.value = oldSpeciesValue;
        }
    });

    
    fileInput.addEventListener('change', async function() {
        const files = Array.from(fileInput.files);
        if (files.length === 0) {
            return;
        }

        window.sharedFiles = files;
        window.currentFileIndex = 0;
        await loadCurrentFile();
    });

    // Add navigation functions
    window.loadCurrentFile = async function() {
        if (window.currentFileIndex < 0 || window.currentFileIndex >= window.sharedFiles.length) {
            document.getElementById('wavFile-help').textContent = 'Select WAV audio files for analysis';
            return;
        }

        const file = window.sharedFiles[window.currentFileIndex];
        document.getElementById('wavFile-help').textContent = file.name;
        
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

        const audioURL = URL.createObjectURL(file);
        document.getElementById('audioPlayer').src = audioURL;

        window.sharedFile = file;

        await loadFile();
        showFile();
    };

    window.navigateToFile = function(direction) {
        if (window.sharedFiles.length === 0) return;
        
        window.currentFileIndex = (window.currentFileIndex + direction + window.sharedFiles.length) % window.sharedFiles.length;
        window.loadCurrentFile();
    };

    // Select Tab
    params.selection.start  = initParam('selection_start', '', ['new-audio']);
    params.selection.stop   = initParam('selection_stop', '', ['new-audio']);
    params.selection.min_freq= initParam('selection_min_freq', '', ['new-audio']);
    params.selection.max_freq= initParam('selection_max_freq', '', ['new-audio']);


}); 
