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

