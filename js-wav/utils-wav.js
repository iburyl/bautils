"use strict";

async function urlToFile(url, filename, mimeType) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  console.log(buffer);
  return new File([buffer], filename, { type: mimeType });
}

function splitOnce(str, separator) {
  const idx = str.indexOf(separator);
  if (idx === -1) return [str, ''];
  return [str.substring(0, idx), str.substring(idx + separator.length)];
}

function parseWavChunks(dataView) {
    const knownChuckIds = new Set(['fmt ', 'data', 'guan', 'wamd', 'junk', 'LIST', 'fact', 'PEAK', 'PAD ', 'bext', 'iXML']);
    let foundChunks = [];

    let lastOffsetWasOdd = false;

    const isKnown = (name) => {};

    function readChunkId(offset, dataView) {
        return String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        );
    }

    let offset = 12;
    while (offset + 8 < dataView.byteLength) {
        const chunkID = readChunkId(offset, dataView);

        if(lastOffsetWasOdd && !knownChuckIds.has(chunkID)) {
            //that is correct padding path, but it is not always being followed
            lastOffsetWasOdd = false;
            offset += 1;
            continue;
        }
        const chunkSize = dataView.getUint32(offset + 4, true);

        if(!knownChuckIds.has(chunkID)) console.log(chunkID, chunkSize);

        foundChunks.push({name:chunkID, off:offset, len:chunkSize});

        lastOffsetWasOdd = ((chunkSize % 2) == 1);
        offset += 8 + chunkSize;
        
        // In some cases wav chunks are incorrectly encoded,
        // if utf-8 symbols are there in guano? or junk? chunks.
        // Will ignore for now.

    }
    return foundChunks;
}

function findChunk(name, chunks) {
    for(let i=0; i<chunks.length; i++) if(chunks[i].name == name) return chunks[i];
    return {off:-1, len:0};
}

function getAudioContext(arrayBuffer)
{
    const dataView = new DataView(arrayBuffer);

    let audioContext;
    let info = {};

    const chunks = parseWavChunks(dataView);

    const fmtSection = findChunk('fmt ', chunks);
    const dataSection = findChunk('data', chunks);
    const guanSection = findChunk('guan', chunks);
    const ixmlSection = findChunk('iXML', chunks);

    //findWavChunk('????', dataView)
    if(fmtSection.off != -1 && dataSection.off != -1)
    {
        const format = dataView.getUint16(fmtSection.off + 8, true);
        const numChannels = dataView.getUint16(fmtSection.off + 8 + 2, true);
        const sampleRate = dataView.getUint32(fmtSection.off + 8 + 4, true);
        const bitsPerSample = dataView.getUint16(fmtSection.off + 8 + 14, true);
     
        const dataSize = dataView.getUint32(dataSection.off + 4, true);

        const durationSeconds = dataSize / (sampleRate * numChannels * (bitsPerSample / 8));

        info.duration = durationSeconds;
        info.sampleRate = sampleRate;
        info.dataFormat = (format==1)?'PCM':(format==3)?'Floating-point':'unknown';
        info.bitsPerSample = bitsPerSample;
        info.numChannels = numChannels;

        /* https://github.com/riggsd/guano-spec/blob/master/guano_specification.md */
        if(guanSection.off != -1)
        {
            const decoder = new TextDecoder("utf-8");
            const str = decoder.decode(new DataView(arrayBuffer, guanSection.off+8, guanSection.len));

            info.guan = new Map();

            const values = str.split("\n");
            values.forEach( (value_pair) =>
            {
                const pair = splitOnce(value_pair, ':');

                info.guan.set(pair[0], pair[1]);
            } );
        }

        if(ixmlSection.off != -1)
        {
            const decoder = new TextDecoder("utf-8");
            const xml = decoder.decode(new DataView(arrayBuffer, ixmlSection.off+8, ixmlSection.len));

            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'application/xml');

            const nodes = doc.querySelectorAll(':root > *:not(:has(*))');
            //const nodes = doc.querySelectorAll(':root > *');

            info.ixml = new Map();

            nodes.forEach( (el) =>
            {
                info.ixml.set(el.tagName, el.textContent);
            } );

        }
        
        audioContext = new window.OfflineAudioContext({numberOfChannels:numChannels, length:dataSize, sampleRate: sampleRate});

    }
    else
    {
        audioContext = new window.AudioContext();
    }

    return {audioContext:audioContext, info:info};
}


// Helper function to convert AudioBuffer to WAV
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, totalSize - 8, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, byteRate, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, blockAlign, true);
    // bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataSize, true);

    // Write the PCM samples
    const offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
        channelData.push(buffer.getChannelData(i));
    }

    let pos = 0;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
            const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset + pos, value, true);
            pos += 2;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Helper function to write strings to DataView
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
} 
