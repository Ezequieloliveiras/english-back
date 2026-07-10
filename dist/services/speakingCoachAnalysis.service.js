"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTranscriptComparison = exports.deriveSpeakingMetrics = exports.buildSpeakingCoachPipeline = exports.comparePhraseToTranscript = exports.normalizeSpeechWords = exports.normalizeAndAnalyzeAudio = exports.analyzePcmWav = exports.speakingAudioExtension = exports.isSupportedSpeakingAudioMime = exports.SpeakingCoachValidationError = void 0;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = __importDefault(require("path"));
class SpeakingCoachValidationError extends Error {
    constructor(status, message, statusCode = 422, audioQuality, comparison, transcript) {
        super(message);
        this.status = status;
        this.statusCode = statusCode;
        this.audioQuality = audioQuality;
        this.comparison = comparison;
        this.transcript = transcript;
    }
}
exports.SpeakingCoachValidationError = SpeakingCoachValidationError;
const MIN_AUDIO_BYTES = 400;
const MAX_DURATION_SECONDS = 30;
const MIN_DURATION_SECONDS = 0.65;
const MIN_RMS = 0.004;
const MIN_PEAK = 0.018;
const MIN_SPEECH_RATIO = 0.1;
const MIN_COVERAGE_FOR_VALID_ATTEMPT = 0.6;
const MIN_SIMILARITY_FOR_VALID_ATTEMPT = 0.45;
const FRAME_SECONDS = 0.02;
const FFMPEG_TIMEOUT_MS = 12000;
const SAMPLE_RATE = 16000;
const SUPPORTED_MIME_TYPES = new Set([
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
]);
const mimeExtension = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
};
const isSupportedSpeakingAudioMime = (mimeType) => {
    if (!mimeType) {
        return false;
    }
    return SUPPORTED_MIME_TYPES.has(mimeType.split(";")[0].trim().toLowerCase());
};
exports.isSupportedSpeakingAudioMime = isSupportedSpeakingAudioMime;
const speakingAudioExtension = (mimeType) => mimeExtension[mimeType?.split(";")[0].trim().toLowerCase() ?? ""] ?? "webm";
exports.speakingAudioExtension = speakingAudioExtension;
const runProcess = (command, args) => new Promise((resolve, reject) => {
    const child = (0, child_process_1.spawn)(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new SpeakingCoachValidationError("processing_error", `${command} timed out`, 503));
    }, FFMPEG_TIMEOUT_MS);
    child.stderr.on("data", (chunk) => {
        stderr += String(chunk).slice(0, 800);
    });
    child.on("error", (error) => {
        clearTimeout(timer);
        reject(new SpeakingCoachValidationError("processing_error", error.message.includes("ENOENT")
            ? `${command} is required for speaking analysis. Install FFmpeg on the backend host.`
            : `${command} failed to start`, 503));
    });
    child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) {
            resolve();
            return;
        }
        reject(new SpeakingCoachValidationError("processing_error", `${command} failed: ${stderr}`, 422));
    });
});
const convertToAnalysisWav = async (inputPath, outputPath) => {
    await runProcess("ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        String(SAMPLE_RATE),
        "-acodec",
        "pcm_s16le",
        outputPath,
    ]);
};
const getPcmDataOffset = (buffer) => {
    let offset = 12;
    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString("ascii", offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        if (chunkId === "data") {
            return { offset: offset + 8, size: chunkSize };
        }
        offset += 8 + chunkSize + (chunkSize % 2);
    }
    throw new SpeakingCoachValidationError("processing_error", "Could not read normalized WAV data", 422);
};
const analyzePcmWav = (buffer) => {
    const data = getPcmDataOffset(buffer);
    const sampleCount = Math.floor(data.size / 2);
    if (sampleCount <= 0) {
        throw new SpeakingCoachValidationError("processing_error", "Normalized audio is empty", 422);
    }
    let sumSquares = 0;
    let peak = 0;
    const samples = new Float32Array(sampleCount);
    for (let index = 0; index < sampleCount; index += 1) {
        const value = buffer.readInt16LE(data.offset + index * 2) / 32768;
        const abs = Math.abs(value);
        samples[index] = value;
        sumSquares += value * value;
        peak = Math.max(peak, abs);
    }
    const rms = Math.sqrt(sumSquares / sampleCount);
    const durationSeconds = sampleCount / SAMPLE_RATE;
    const frameSize = Math.max(1, Math.floor(SAMPLE_RATE * FRAME_SECONDS));
    const frameRms = [];
    for (let offset = 0; offset < samples.length; offset += frameSize) {
        const end = Math.min(samples.length, offset + frameSize);
        let frameSum = 0;
        for (let index = offset; index < end; index += 1) {
            frameSum += samples[index] * samples[index];
        }
        frameRms.push(Math.sqrt(frameSum / (end - offset)));
    }
    const sorted = [...frameRms].sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
    const speechThreshold = Math.max(noiseFloor * 3.2, 0.012);
    const speechMask = frameRms.map((value) => value >= speechThreshold);
    const speechFrames = speechMask.filter(Boolean).length;
    const speechSeconds = speechFrames * FRAME_SECONDS;
    const speechRatio = Math.min(1, speechSeconds / Math.max(durationSeconds, FRAME_SECONDS));
    const silenceRatio = 1 - speechRatio;
    const hasSpeech = durationSeconds >= MIN_DURATION_SECONDS &&
        rms >= MIN_RMS &&
        peak >= MIN_PEAK &&
        speechRatio >= MIN_SPEECH_RATIO;
    const speechSegments = [];
    let segmentStart = null;
    speechMask.forEach((isSpeech, frameIndex) => {
        if (isSpeech && segmentStart === null) {
            segmentStart = frameIndex * FRAME_SECONDS;
        }
        if ((!isSpeech || frameIndex === speechMask.length - 1) && segmentStart !== null) {
            const segmentEnd = Math.min(durationSeconds, (isSpeech && frameIndex === speechMask.length - 1 ? frameIndex + 1 : frameIndex) * FRAME_SECONDS);
            const segmentDuration = segmentEnd - segmentStart;
            if (segmentDuration >= FRAME_SECONDS * 2) {
                speechSegments.push({
                    start: Number(segmentStart.toFixed(3)),
                    end: Number(segmentEnd.toFixed(3)),
                    duration: Number(segmentDuration.toFixed(3)),
                });
            }
            segmentStart = null;
        }
    });
    return {
        durationSeconds: Number(durationSeconds.toFixed(3)),
        rms: Number(rms.toFixed(5)),
        peak: Number(peak.toFixed(5)),
        speechSeconds: Number(speechSeconds.toFixed(3)),
        speechRatio: Number(speechRatio.toFixed(3)),
        silenceRatio: Number(silenceRatio.toFixed(3)),
        hasSpeech,
        speechSegments,
        reason: hasSpeech ? undefined : "low_energy_or_short_speech",
    };
};
exports.analyzePcmWav = analyzePcmWav;
const normalizeAndAnalyzeAudio = async (input) => {
    if (input.buffer.length < MIN_AUDIO_BYTES) {
        throw new SpeakingCoachValidationError("too_short", "A gravação está vazia ou curta demais.", 422);
    }
    if (!(0, exports.isSupportedSpeakingAudioMime)(input.mimeType)) {
        throw new SpeakingCoachValidationError("processing_error", "Formato de áudio não suportado.", 415);
    }
    const dir = await (0, promises_1.mkdtemp)(path_1.default.join((0, os_1.tmpdir)(), "english-os-speaking-"));
    const inputPath = path_1.default.join(dir, `input.${(0, exports.speakingAudioExtension)(input.mimeType)}`);
    const wavPath = path_1.default.join(dir, "analysis.wav");
    try {
        await (0, promises_1.writeFile)(inputPath, input.buffer);
        await convertToAnalysisWav(inputPath, wavPath);
        const wavBuffer = await (0, promises_1.readFile)(wavPath);
        const audioQuality = (0, exports.analyzePcmWav)(wavBuffer);
        if (audioQuality.durationSeconds > MAX_DURATION_SECONDS) {
            throw new SpeakingCoachValidationError("processing_error", "A gravação está longa demais para análise.", 400, audioQuality);
        }
        if (audioQuality.durationSeconds < MIN_DURATION_SECONDS) {
            throw new SpeakingCoachValidationError("too_short", "A gravação foi curta demais para avaliar a frase.", 422, audioQuality);
        }
        if (audioQuality.rms < MIN_RMS || audioQuality.peak < MIN_PEAK) {
            throw new SpeakingCoachValidationError("no_speech", "Nenhuma fala foi detectada.", 422, audioQuality);
        }
        if (audioQuality.speechRatio < MIN_SPEECH_RATIO) {
            throw new SpeakingCoachValidationError("unclear_audio", "Não foi possível compreender sua voz.", 422, audioQuality);
        }
        return { wavBuffer, audioQuality };
    }
    finally {
        await (0, promises_1.rm)(dir, { recursive: true, force: true }).catch(() => null);
    }
};
exports.normalizeAndAnalyzeAudio = normalizeAndAnalyzeAudio;
const expandContractions = (text) => text
    .toLowerCase()
    .replace(/\bwanna\b/g, "want to")
    .replace(/\bgonna\b/g, "going to")
    .replace(/\bdunno\b/g, "do not know")
    .replace(/\bkinda\b/g, "kind of")
    .replace(/\boutta\b/g, "out of")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\bdon't\b/g, "do not")
    .replace(/\bcan't\b/g, "can not")
    .replace(/\bwon't\b/g, "will not");
const normalizeSpeechWords = (text) => expandContractions(text)
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
exports.normalizeSpeechWords = normalizeSpeechWords;
const levenshtein = (expected, spoken) => {
    const dp = Array.from({ length: expected.length + 1 }, () => Array(spoken.length + 1).fill(0));
    for (let i = 0; i <= expected.length; i += 1)
        dp[i][0] = i;
    for (let j = 0; j <= spoken.length; j += 1)
        dp[0][j] = j;
    for (let i = 1; i <= expected.length; i += 1) {
        for (let j = 1; j <= spoken.length; j += 1) {
            const cost = expected[i - 1] === spoken[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[expected.length][spoken.length];
};
const comparePhraseToTranscript = (expectedText, transcribedText) => {
    const expectedWords = (0, exports.normalizeSpeechWords)(expectedText);
    const spokenWords = (0, exports.normalizeSpeechWords)(transcribedText);
    const remaining = [...spokenWords];
    const matchedWords = [];
    const missingWords = [];
    expectedWords.forEach((word) => {
        const index = remaining.indexOf(word);
        if (index >= 0) {
            matchedWords.push(word);
            remaining.splice(index, 1);
            return;
        }
        missingWords.push(word);
    });
    const distance = levenshtein(expectedWords, spokenWords);
    const wordErrorRate = expectedWords.length ? distance / expectedWords.length : 1;
    const coverage = expectedWords.length ? matchedWords.length / expectedWords.length : 0;
    const similarity = Math.max(0, 1 - wordErrorRate);
    return {
        expectedWords,
        spokenWords,
        matchedWords,
        missingWords,
        extraWords: remaining,
        wordErrorRate: Number(wordErrorRate.toFixed(3)),
        coverage: Number(coverage.toFixed(3)),
        similarity: Number(similarity.toFixed(3)),
    };
};
exports.comparePhraseToTranscript = comparePhraseToTranscript;
const clampScore = (value) => Number(Math.min(10, Math.max(0, value)).toFixed(1));
const phonemeDictionary = {
    a: ["AH"],
    about: ["AH", "B", "AW", "T"],
    after: ["AE", "F", "T", "ER"],
    am: ["AE", "M"],
    are: ["AA", "R"],
    check: ["CH", "EH", "K"],
    did: ["D", "IH", "D"],
    do: ["D", "UW"],
    going: ["G", "OW", "IH", "NG"],
    i: ["AY"],
    if: ["IH", "F"],
    is: ["IH", "Z"],
    it: ["IH", "T"],
    know: ["N", "OW"],
    kind: ["K", "AY", "N", "D"],
    lunch: ["L", "AH", "N", "CH"],
    my: ["M", "AY"],
    not: ["N", "AA", "T"],
    of: ["AH", "V"],
    out: ["AW", "T"],
    routine: ["R", "UW", "T", "IY", "N"],
    scope: ["S", "K", "OW", "P"],
    talk: ["T", "AO", "K"],
    the: ["DH", "AH"],
    this: ["DH", "IH", "S"],
    to: ["T", "UW"],
    understand: ["AH", "N", "D", "ER", "S", "T", "AE", "N", "D"],
    want: ["W", "AA", "N", "T"],
    you: ["Y", "UW"],
};
const vowels = new Set(["a", "e", "i", "o", "u"]);
const fallbackGraphemeToPhonemes = (word) => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    const phonemes = [];
    for (let index = 0; index < clean.length; index += 1) {
        const current = clean[index];
        const pair = clean.slice(index, index + 2);
        if (pair === "th") {
            phonemes.push("TH");
            index += 1;
        }
        else if (pair === "sh") {
            phonemes.push("SH");
            index += 1;
        }
        else if (pair === "ch") {
            phonemes.push("CH");
            index += 1;
        }
        else if (pair === "ng") {
            phonemes.push("NG");
            index += 1;
        }
        else if (vowels.has(current)) {
            phonemes.push(current.toUpperCase());
        }
        else {
            phonemes.push(current.toUpperCase());
        }
    }
    return phonemes;
};
const wordToPhonemes = (word) => phonemeDictionary[word] ?? fallbackGraphemeToPhonemes(word);
const alignWords = (expectedWords, spokenWords) => {
    const dp = Array.from({ length: expectedWords.length + 1 }, () => Array(spokenWords.length + 1).fill(0));
    const back = Array.from({ length: expectedWords.length + 1 }, () => Array(spokenWords.length + 1).fill(""));
    for (let i = 0; i <= expectedWords.length; i += 1) {
        dp[i][0] = i;
        if (i > 0)
            back[i][0] = "delete";
    }
    for (let j = 0; j <= spokenWords.length; j += 1) {
        dp[0][j] = j;
        if (j > 0)
            back[0][j] = "insert";
    }
    for (let i = 1; i <= expectedWords.length; i += 1) {
        for (let j = 1; j <= spokenWords.length; j += 1) {
            const substitutionCost = expectedWords[i - 1] === spokenWords[j - 1] ? 0 : 1;
            const candidates = [
                { cost: dp[i - 1][j - 1] + substitutionCost, move: "match" },
                { cost: dp[i - 1][j] + 1, move: "delete" },
                { cost: dp[i][j - 1] + 1, move: "insert" },
            ].sort((a, b) => a.cost - b.cost);
            dp[i][j] = candidates[0].cost;
            back[i][j] = candidates[0].move;
        }
    }
    const result = [];
    let i = expectedWords.length;
    let j = spokenWords.length;
    while (i > 0 || j > 0) {
        const move = back[i][j];
        if (move === "match") {
            const expectedWord = expectedWords[i - 1];
            const spokenWord = spokenWords[j - 1];
            result.unshift({
                expectedWord,
                spokenWord,
                status: expectedWord === spokenWord ? "exact" : "substitution",
            });
            i -= 1;
            j -= 1;
        }
        else if (move === "delete") {
            result.unshift({ expectedWord: expectedWords[i - 1], status: "missing" });
            i -= 1;
        }
        else {
            result.unshift({ spokenWord: spokenWords[j - 1], status: "extra" });
            j -= 1;
        }
    }
    return result;
};
const estimateSpokenWordTimings = (spokenWords, audioQuality) => {
    if (spokenWords.length === 0) {
        return [];
    }
    const firstSegment = audioQuality.speechSegments[0];
    const lastSegment = audioQuality.speechSegments[audioQuality.speechSegments.length - 1];
    const speechStart = firstSegment?.start ?? 0;
    const speechEnd = lastSegment?.end ?? audioQuality.durationSeconds;
    const availableSeconds = Math.max(FRAME_SECONDS, speechEnd - speechStart);
    const weights = spokenWords.map((word) => Math.max(0.65, Math.min(1.8, word.length / 4)));
    const totalWeight = weights.reduce((total, value) => total + value, 0);
    let cursor = speechStart;
    return spokenWords.map((word, index) => {
        const duration = index === spokenWords.length - 1 ? speechEnd - cursor : (availableSeconds * weights[index]) / totalWeight;
        const start = cursor;
        const end = Math.min(speechEnd, cursor + Math.max(FRAME_SECONDS, duration));
        cursor = end;
        return {
            word,
            start: Number(start.toFixed(3)),
            end: Number(end.toFixed(3)),
        };
    });
};
const buildWordAlignment = (comparison, audioQuality) => {
    const spokenTimings = estimateSpokenWordTimings(comparison.spokenWords, audioQuality);
    let spokenIndex = 0;
    return alignWords(comparison.expectedWords, comparison.spokenWords).map((item) => {
        if (!item.spokenWord) {
            return item;
        }
        const timing = spokenTimings[spokenIndex];
        spokenIndex += 1;
        return {
            ...item,
            start: timing?.start,
            end: timing?.end,
        };
    });
};
const finalConsonant = (word) => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    const last = clean[clean.length - 1];
    return last && !vowels.has(last) ? last.toUpperCase() : undefined;
};
const analyzePhonemes = (alignment, comparison) => {
    const issues = [];
    alignment.forEach((item) => {
        if (item.status === "exact") {
            const expectedWord = item.expectedWord;
            const consonant = expectedWord ? finalConsonant(expectedWord) : undefined;
            if (expectedWord && consonant && item.end !== undefined && item.start !== undefined && item.end - item.start < 0.16) {
                issues.push({
                    word: expectedWord,
                    expectedPhonemes: wordToPhonemes(expectedWord),
                    spokenPhonemes: wordToPhonemes(item.spokenWord ?? expectedWord),
                    issue: "final_consonant_risk",
                });
            }
            return;
        }
        const word = item.expectedWord ?? item.spokenWord ?? "";
        issues.push({
            word,
            expectedPhonemes: item.expectedWord ? wordToPhonemes(item.expectedWord) : [],
            spokenPhonemes: item.spokenWord ? wordToPhonemes(item.spokenWord) : [],
            issue: item.status === "missing"
                ? "missing_word"
                : item.status === "extra"
                    ? "extra_word"
                    : "substitution",
        });
    });
    const penalty = comparison.missingWords.length * 1.25 +
        comparison.extraWords.length * 0.55 +
        issues.filter((issue) => issue.issue === "substitution").length * 0.9 +
        issues.filter((issue) => issue.issue === "final_consonant_risk").length * 0.35;
    const problemSounds = Array.from(new Set(issues.flatMap((issue) => issue.expectedPhonemes).filter((phoneme) => !["AH", "A", "E", "I", "O", "U"].includes(phoneme)))).slice(0, 8);
    return {
        score: clampScore(10 - penalty),
        issues: issues.slice(0, 12),
        problemSounds,
    };
};
const analyzeRhythm = (audioQuality, comparison) => {
    const speechSeconds = Math.max(audioQuality.speechSeconds, FRAME_SECONDS);
    const wordsPerMinute = comparison.spokenWords.length > 0 ? (comparison.spokenWords.length / speechSeconds) * 60 : 0;
    const averageWordSeconds = comparison.spokenWords.length > 0 ? speechSeconds / comparison.spokenWords.length : 0;
    const longPauseCount = audioQuality.speechSegments.reduce((total, segment, index, segments) => {
        if (index === 0)
            return total;
        return segment.start - segments[index - 1].end > 0.45 ? total + 1 : total;
    }, 0);
    const wpmPenalty = wordsPerMinute < 80 ? (80 - wordsPerMinute) / 18 : wordsPerMinute > 190 ? (wordsPerMinute - 190) / 22 : 0;
    const silencePenalty = Math.max(0, audioQuality.silenceRatio - 0.45) * 4;
    const pausePenalty = longPauseCount * 0.75;
    return {
        score: clampScore(10 - wpmPenalty - silencePenalty - pausePenalty - comparison.wordErrorRate * 2),
        wordsPerMinute: Number(wordsPerMinute.toFixed(1)),
        averageWordSeconds: Number(averageWordSeconds.toFixed(3)),
        pauseCount: Math.max(0, audioQuality.speechSegments.length - 1),
        longPauseCount,
        speechRatio: audioQuality.speechRatio,
    };
};
const buildSpeakingCoachPipeline = (audioQuality, comparison) => {
    const alignment = buildWordAlignment(comparison, audioQuality);
    return {
        alignment,
        phonemeAnalysis: analyzePhonemes(alignment, comparison),
        rhythmAnalysis: analyzeRhythm(audioQuality, comparison),
        analysisEngine: {
            normalization: "ffmpeg_pcm_16k_mono",
            vad: "local_energy_vad",
            transcription: "openai_gpt_4o_mini_transcribe",
            forcedAlignment: "local_energy_word_alignment",
            phoneme: "local_cmu_dictionary_plus_g2p",
            rhythm: "local_acoustic_metrics",
        },
    };
};
exports.buildSpeakingCoachPipeline = buildSpeakingCoachPipeline;
const deriveSpeakingMetrics = (audioQuality, comparison, pipeline) => {
    const coverageScore = comparison.coverage * 10;
    const similarityScore = comparison.similarity * 10;
    const phonemeScore = pipeline?.phonemeAnalysis.score ?? similarityScore;
    const rhythmScore = pipeline?.rhythmAnalysis.score ?? Math.min(10, 6 + audioQuality.speechRatio * 3 - comparison.wordErrorRate * 3);
    const volumePenalty = audioQuality.rms < 0.012 ? 1.2 : 0;
    const fluencyBase = Math.min(10, audioQuality.speechRatio * 12);
    const rhythmBase = Math.min(10, rhythmScore);
    const connectedBase = Math.min(10, 5 + comparison.coverage * 4 - comparison.wordErrorRate * 2);
    const naturalnessBase = (similarityScore * 0.4 + fluencyBase * 0.3 + rhythmScore * 0.3) - volumePenalty;
    const metrics = [
        { label: "Pronunciation Score", value: clampScore(phonemeScore * 0.45 + similarityScore * 0.35 + coverageScore * 0.2 - volumePenalty) },
        { label: "Naturalness", value: clampScore(naturalnessBase) },
        { label: "Connected Speech", value: clampScore(connectedBase) },
        { label: "Stress", value: clampScore(similarityScore * 0.7 + rhythmBase * 0.3 - volumePenalty) },
        { label: "Intonation", value: clampScore(fluencyBase * 0.65 + similarityScore * 0.35 - volumePenalty) },
        { label: "Rhythm", value: clampScore(rhythmBase - volumePenalty) },
        { label: "Fluency", value: clampScore(fluencyBase * 0.6 + coverageScore * 0.4 - volumePenalty) },
        { label: "Word Alignment", value: clampScore(coverageScore * 0.7 + similarityScore * 0.3) },
        { label: "Phoneme Accuracy", value: clampScore(phonemeScore) },
    ];
    let overallScore = clampScore(metrics.reduce((total, metric) => total + metric.value, 0) / metrics.length);
    if (comparison.coverage < 0.1)
        overallScore = Math.min(overallScore, 1);
    else if (comparison.coverage < MIN_COVERAGE_FOR_VALID_ATTEMPT)
        overallScore = Math.min(overallScore, 3);
    const maxAllowedMetric = comparison.coverage < 0.1 ? 1 : comparison.coverage < MIN_COVERAGE_FOR_VALID_ATTEMPT ? 3 : 10;
    return {
        overallScore,
        metrics: metrics.map((metric) => ({ ...metric, value: clampScore(Math.min(metric.value, maxAllowedMetric)) })),
    };
};
exports.deriveSpeakingMetrics = deriveSpeakingMetrics;
const validateTranscriptComparison = (transcript, audioQuality, comparison) => {
    if (!transcript.trim() || comparison.spokenWords.length === 0) {
        throw new SpeakingCoachValidationError("no_speech", "Nenhuma fala foi detectada.", 422, audioQuality, comparison, transcript);
    }
    if (comparison.spokenWords.length < Math.max(2, Math.ceil(comparison.expectedWords.length * 0.25))) {
        throw new SpeakingCoachValidationError("too_short", "A gravação foi curta demais para avaliar a frase.", 422, audioQuality, comparison, transcript);
    }
    if (comparison.coverage < MIN_COVERAGE_FOR_VALID_ATTEMPT ||
        comparison.similarity < MIN_SIMILARITY_FOR_VALID_ATTEMPT) {
        throw new SpeakingCoachValidationError("wrong_phrase", "A gravação não corresponde à frase de treino.", 422, audioQuality, comparison, transcript);
    }
};
exports.validateTranscriptComparison = validateTranscriptComparison;
