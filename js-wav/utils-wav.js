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

function getAudioContext(arrayBuffer, infoDiv)
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
