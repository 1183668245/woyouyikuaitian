const BG_ANIMATION_CONFIG = {
    frameCount: 152,
    startIndex: 0,
    fps: 24,
    loop: true,
    extensions: ["jpg"],
    drawMode: "cover",
    path: (index, extension) => `image/bg2/帧 ${index}.${extension}`
};

const bgCanvas = document.getElementById("bgFrameCanvas");
const heroMobileCanvas = document.getElementById("heroFrameCanvasMobile");
const heroMobileContainer = document.querySelector(".hero-animation-mobile");
const heroMobilePlaceholder = document.querySelector(".hero-mobile-placeholder");

const MOBILE_BG_ANIMATION_CONFIG = {
    frameCount: 152,
    startIndex: 0,
    fps: 24,
    loop: true,
    extensions: ["jpg"],
    drawMode: "cover",
    path: (index, extension) => `image/bg l/帧 ${index}.${extension}`
};

if (bgCanvas) {
    initializeFrameAnimation({
        container: document.body,
        canvas: bgCanvas,
        config: BG_ANIMATION_CONFIG,
        logPrefix: "bg-animation"
    });
}

if (heroMobileCanvas && heroMobileContainer && heroMobilePlaceholder) {
    initializeMobileBackgroundAnimation();
}

function initializeMobileBackgroundAnimation() {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    let hasInitialized = false;

    const tryInitialize = () => {
        if (hasInitialized || !mobileQuery.matches) {
            return;
        }

        hasInitialized = true;

        initializeFrameAnimation({
            container: heroMobileContainer,
            canvas: heroMobileCanvas,
            placeholder: heroMobilePlaceholder,
            config: MOBILE_BG_ANIMATION_CONFIG,
            logPrefix: "mobile-bg-animation"
        });
    };

    tryInitialize();

    if (typeof mobileQuery.addEventListener === "function") {
        mobileQuery.addEventListener("change", tryInitialize);
        return;
    }

    if (typeof mobileQuery.addListener === "function") {
        mobileQuery.addListener(tryInitialize);
    }
}

function initializeFrameAnimation({ container, canvas, placeholder = null, config, logPrefix }) {
    const context = canvas.getContext("2d");

    if (!context) {
        console.info(`[${logPrefix}] Canvas 2D context unavailable.`);

        if (placeholder) {
            showPlaceholder(canvas, placeholder);
        }

        return;
    }

    const state = {
        frames: [],
        currentFrameIndex: 0,
        frameDuration: 1000 / Math.max(1, config.fps || 24),
        rafId: 0,
        lastTimestamp: 0,
        drawingReady: false
    };

    const resizeAndRedraw = () => {
        resizeCanvasToContainer(canvas, container);

        if (state.frames.length > 0) {
            drawFrame(context, canvas, state.frames[state.currentFrameIndex], config.drawMode);
        }
    };

    window.addEventListener("resize", resizeAndRedraw);
    resizeAndRedraw();

    loadAnimationFrames(config)
        .then((frames) => {
            if (!frames.length) {
                console.info(`[${logPrefix}] No frame assets found.`);

                if (placeholder) {
                    showPlaceholder(canvas, placeholder);
                }

                return;
            }

            state.frames = frames;
            state.currentFrameIndex = 0;
            state.drawingReady = true;

            if (placeholder) {
                hidePlaceholder(canvas, placeholder);
            } else {
                canvas.style.display = "block";
            }

            resizeAndRedraw();
            startPlaybackLoop(state, context, canvas, config.drawMode, config.loop);
        })
        .catch((error) => {
            console.info(`[${logPrefix}] Failed to load frames.`, error);

            if (placeholder) {
                showPlaceholder(canvas, placeholder);
            }
        });
}

function loadAnimationFrames(config) {
    return findWorkingExtension(config).then((extension) => {
        if (!extension) {
            return [];
        }

        const frameTasks = [];
        const startIndex = typeof config.startIndex === "number" ? config.startIndex : 1;
        const endIndex = startIndex + config.frameCount - 1;

        for (let index = startIndex; index <= endIndex; index += 1) {
            frameTasks.push(loadImage(config.path(index, extension)).catch(() => null));
        }

        return Promise.all(frameTasks).then((images) => images.filter(Boolean));
    });
}

function findWorkingExtension(config) {
    const attempts = config.extensions.map((extension) =>
        loadImage(config.path(1, extension))
            .then((image) => {
                image.dataset.frameExtension = extension;
                return extension;
            })
            .catch(() => null)
    );

    return Promise.all(attempts).then((extensions) => extensions.find(Boolean) || null);
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}

function resizeCanvasToContainer(canvas, container) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(container.clientWidth));
    const height = Math.max(1, Math.round(container.clientHeight));
    const targetWidth = Math.round(width * devicePixelRatio);
    const targetHeight = Math.round(height * devicePixelRatio);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
    }
}

function drawFrameContain(context, canvas, image) {
    if (!image) {
        return;
    }

    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const offsetX = (canvas.width - drawWidth) / 2;
    const offsetY = (canvas.height - drawHeight) / 2;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function drawFrameCover(context, canvas, image) {
    if (!image) {
        return;
    }

    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const offsetX = (canvas.width - drawWidth) / 2;
    const offsetY = (canvas.height - drawHeight) / 2;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function drawFrame(context, canvas, image, drawMode) {
    if (drawMode === "cover") {
        drawFrameCover(context, canvas, image);
        return;
    }

    drawFrameContain(context, canvas, image);
}

function startPlaybackLoop(state, context, canvas, drawMode, loop) {
    const animate = (timestamp) => {
        if (!state.drawingReady || state.frames.length === 0) {
            return;
        }

        if (!state.lastTimestamp) {
            state.lastTimestamp = timestamp;
        }

        const elapsed = timestamp - state.lastTimestamp;

        if (elapsed >= state.frameDuration) {
            const steps = Math.max(1, Math.floor(elapsed / state.frameDuration));
            const nextIndex = state.currentFrameIndex + steps;

            if (loop) {
                state.currentFrameIndex = nextIndex % state.frames.length;
            } else {
                state.currentFrameIndex = Math.min(nextIndex, state.frames.length - 1);
            }

            state.lastTimestamp = timestamp;
            drawFrame(context, canvas, state.frames[state.currentFrameIndex], drawMode);
        }

        if (loop || state.currentFrameIndex < state.frames.length - 1) {
            state.rafId = window.requestAnimationFrame(animate);
        }
    };

    state.rafId = window.requestAnimationFrame(animate);
}

function hidePlaceholder(canvas, placeholder) {
    placeholder.style.display = "none";
    canvas.style.display = "block";
}

function showPlaceholder(canvas, placeholder) {
    canvas.style.display = "none";
    placeholder.style.display = "block";
}
