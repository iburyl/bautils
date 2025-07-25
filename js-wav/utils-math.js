"use strict";

// FIR filter implementation
class FIRFilter {
    constructor(filterType, cutoffFreq, sampleRate, filterLength = 101) {
        this.filterType = filterType; // 'highpass' or 'lowpass'
        this.cutoffFreq = cutoffFreq;
        this.sampleRate = sampleRate;
        this.filterLength = filterLength;
        this.coefficients = this.designFilter();
    }

    designFilter() {
        const normalizedFreq = this.cutoffFreq / (this.sampleRate / 2);
        const coefficients = new Array(this.filterLength);
        const halfLength = Math.floor(this.filterLength / 2);

        // Design filter coefficients using window method
        for (let i = 0; i < this.filterLength; i++) {
            const n = i - halfLength;
            if (n === 0) {
                coefficients[i] = this.filterType === 'lowpass' ? normalizedFreq : 1 - normalizedFreq;
            } else {
                const sinc = Math.sin(Math.PI * normalizedFreq * n) / (Math.PI * n);
                coefficients[i] = this.filterType === 'lowpass' ? sinc : -sinc;
            }
        }

        // Apply Hamming window to reduce ripple
        const window = this.hammingWindow(this.filterLength);
        for (let i = 0; i < this.filterLength; i++) {
            coefficients[i] *= window[i];
        }

        return coefficients;
    }

    hammingWindow(length) {
        const window = new Array(length);
        for (let i = 0; i < length; i++) {
            window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (length - 1));
        }
        return window;
    }

    applyFilter(inputSignal) {
        const outputSignal = new Float32Array(inputSignal.length);
        const halfLength = Math.floor(this.filterLength / 2);

        for (let i = 0; i < inputSignal.length; i++) {
            let sum = 0;
            for (let j = 0; j < this.filterLength; j++) {
                const inputIndex = i - halfLength + j;
                if (inputIndex >= 0 && inputIndex < inputSignal.length) {
                    sum += inputSignal[inputIndex] * this.coefficients[j];
                }
            }
            outputSignal[i] = sum;
        }

        return outputSignal;
    }
}

function kaiserWindow(N, beta) {
    /* https://en.wikipedia.org/wiki/Kaiser_window */
    function besselI0(x) {
        let sum = 1.0;
        let y = x * x / 4.0;
        let t = y;
        for (let i = 1; t > 1e-8 * sum; i++) {
            sum += t;
            t *= y / (i * i);
        }
        return sum;
    }

    const window = new Array(N);
    const denom = besselI0(beta);
    const halfN = (N - 1) / 2;

    for (let n = 0; n < N; n++) {
        let ratio = (n - halfN) / halfN;
        let arg = beta * Math.sqrt(1 - ratio * ratio);
        window[n] = besselI0(arg) / denom;
    }

    return window;
}

function blackmanHarris7thOrderWindow(N) {
    const window = new Array(N);
    // Coefficients source: https://www.researchgate.net/publication/3908127_A_family_of_cosine-sum_windows_for_high-resolution_measurements
    const a = [0.2712203605850388, -0.4334446123274422, 0.2180041228929303, -0.06578534329560609, 0.01076186730534183, -0.0007700127105808265, 0.00001368088305992921];

    for (let n = 0; n < N; n++) {
        const ratio = n / (N - 1);
        let sum = 0;
        for (let k = 0; k < a.length; k++) {
            sum += a[k] * Math.cos(2 * k * Math.PI * ratio);
        }
        window[n] = sum;
    }

    return window;
}

function gradient(data, i, j) {
    const di = (data[i + 1]?.[j] ?? data[i][j]) - (data[i - 1]?.[j] ?? data[i][j]);
    const dj = (data[i]?.[j + 1] ?? data[i][j]) - (data[i]?.[j - 1] ?? data[i][j]);
    return [dj / 2, di / 2];
}


function bilinear(data, x, y) {
    const i = Math.floor(x), j = Math.floor(y);
    const dx = x - i, dy = y - j;

    const v00 = data[i]?.[j]     ?? 0;
    const v01 = data[i]?.[j + 1] ?? 0;
    const v10 = data[i + 1]?.[j] ?? 0;
    const v11 = data[i + 1]?.[j + 1] ?? 0;

    return (1 - dx) * (1 - dy) * v00 +
           (1 - dx) * dy       * v01 +
           dx       * (1 - dy) * v10 +
           dx       * dy       * v11;
}

function gradientSubpixel(data, x, y, delta = 2) {
    const dt = (bilinear(data, x, y + delta) - bilinear(data, x, y - delta)) / (2 * delta);
    const df = (bilinear(data, x + delta, y) - bilinear(data, x - delta, y)) / (2 * delta);
    return [dt, df];
}

const interp = bilinear;

function d2_t(data, x, y, delta = 0.5) {
    return (interp(data, x, y + delta) - 2 * interp(data, x, y) + interp(data, x, y - delta)) / (delta * delta);
}

function d2_f(data, x, y, delta = 0.5) {
    return (interp(data, x + delta, y) - 2 * interp(data, x, y) + interp(data, x - delta, y)) / (delta * delta);
}

function d2_tf(data, x, y, delta = 0.5) {
    return (interp(data, x + delta, y + delta) - interp(data, x + delta, y - delta)
          - interp(data, x - delta, y + delta) + interp(data, x - delta, y - delta)) / (4 * delta * delta);
}

function hessian(data, x, y, delta = 2) {
    const dtt = d2_t(data, x, y, delta);
    const dff = d2_f(data, x, y, delta);
    const dtf = d2_tf(data, x, y, delta);
    return [
        [dtt, dtf],
        [dtf, dff]
    ];
}

function eigen2x2(H) {
    const [a, b] = H[0];
    const [_, d] = H[1];
    const trace = a + d;
    const det = a * d - b * b;
    const delta = Math.sqrt((trace * trace) / 4 - det);

    const lambda1 = trace / 2 + delta;
    const lambda2 = trace / 2 - delta;

    const v1 = b !== 0
        ? [lambda1 - d, b]
        : [1, 0];
    const v2 = b !== 0
        ? [lambda2 - d, b]
        : [0, 1];

    const norm1 = Math.hypot(...v1);
    const norm2 = Math.hypot(...v2);

    return {
        values: [lambda1, lambda2],
        vectors: [
            [v1[0] / norm1, v1[1] / norm1],
            [v2[0] / norm2, v2[1] / norm2]
        ]
    };
}


