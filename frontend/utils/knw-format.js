/*
 * This file is part of The Brotherhood Project
 *
 * Copyright (C) 2026  The Brotherhood Project Developers
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * .knw file format - Protocol Version 1.0 (browser side)
 *
 * Mirrors app/knw_format.py on the backend. The same byte layout and
 * canonical-JSON hashing rules apply here so that files round-trip
 * identically across the two pipelines.
 *
 * Binary layout (little-endian where applicable):
 *   0..2  3 bytes   Magic "KNW"
 *   3..4  2 bytes   Protocol version (1)
 *   5     1 byte    Compression algorithm (1 = zstd)
 *   6..N  N bytes   zstd-compressed canonical-JSON payload
 *
 * zstd encoding/decoding is provided by `@bokuweb/zstd-wasm` (loaded as
 * an ES module from jsDelivr on first use). The bytes it produces are
 * byte-for-byte compatible with the Python `zstandard` library used by
 * the backend. Hashing uses the browser's native SubtleCrypto (SHA-256).
 *
 * Canonical JSON for hashing follows **RFC 8785 (JCS)** — see the
 * `canonicalJSON()` implementation below. The backend uses the `jcs`
 * Python package for the same purpose. Both MUST agree byte-for-byte;
 */

const MAGIC = "KNW";
const MAGIC_BYTES = new Uint8Array([0x4B, 0x4E, 0x57]); // "KNW"
const PROTOCOL_VERSION = 1;
const COMPRESSION_ZSTD = 1;
const HEADER_SIZE = 6;

const DEFAULT_LICENSE = Object.freeze({
    name: "CC-BY-SA-4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
});

const ZSTD_LIB_URL = "https://cdn.jsdelivr.net/npm/@bokuweb/zstd-wasm@0.0.27/+esm";
const ZSTD_LIB_URL_FALLBACK = "https://esm.sh/@bokuweb/zstd-wasm@0.0.27";

// The wasm binary is served same-origin from /frontend/vendor/zstd.wasm
// (downloaded from the npm package) so that init()'s fetch is not blocked
// by CORS when running on a different origin than the CDN.
const ZSTD_WASM_URL = "/frontend/vendor/zstd.wasm";

class KNWFormatError extends Error {
    constructor(message) {
        super(message);
        this.name = "KNWFormatError";
    }
}

let _zstdPromise = null;

/**
 * Lazy-load and initialise @bokuweb/zstd-wasm via dynamic import().
 * Returns the codec object: { compress, decompress }.
 *
 * The library's `init()` must be awaited once before compress/decompress
 * are called; subsequent calls reuse the already-initialised instance.
 *
 * `init()` is given the same-origin URL of the vendored wasm binary so
 * the wasm fetch is not subject to cross-origin restrictions.
 */
async function getZstd() {
    if (_zstdPromise) return _zstdPromise;

    _zstdPromise = (async () => {
        const sources = [ZSTD_LIB_URL, ZSTD_LIB_URL_FALLBACK];
        let lastErr = null;
        for (const url of sources) {
            try {
                const mod = await import(/* @vite-ignore */ url);
                // The ESM bundle exports `init`, `compress`, `decompress`.
                if (typeof mod.init === "function") {
                    await mod.init(ZSTD_WASM_URL);
                }
                if (typeof mod.compress !== "function" || typeof mod.decompress !== "function") {
                    throw new Error("module did not export compress/decompress");
                }
                return { compress: mod.compress, decompress: mod.decompress };
            } catch (err) {
                lastErr = err;
            }
        }
        throw new KNWFormatError(
            `Could not load @bokuweb/zstd-wasm (zstd encoder/decoder)${lastErr ? `: ${lastErr.message}` : ""}`
        );
    })();
    return _zstdPromise;
}

/**
 * RFC 8785 (JSON Canonicalization Scheme) serializer.
 *
 * Must produce bytes that are byte-equal to the backend's
 * `jcs.canonicalize()` output for the same input. The two pipelines are
 *
 * Spec summary (RFC 8785):
 *   - keys sorted by Unicode code-point order,
 *   - no whitespace,
 *   - UTF-8 (already implicit via TextEncoder),
 *   - non-ASCII chars emitted raw (no \uXXXX) when shorter,
 *   - numbers in shortest round-trippable form,
 *   - arrays preserve input order (never sorted),
 *   - NaN / Infinity rejected (JSON-spec violation).
 *
 * Note on whole-valued floats: JavaScript already collapses `1.0` and `1`
 * to the same IEEE 754 double, and `(1.0).toString() === "1"`. The
 * Python side runs an explicit `int(obj)` step before `jcs.canonicalize`
 * to mirror this; no equivalent normalisation is needed here.
 */
function canonicalJSON(value) {
    return jcsSerialize(value, new WeakSet());
}

function jcsSerialize(value, seen) {
    if (value === null) return "null";
    if (value === undefined) {
        throw new KNWFormatError("JCS: cannot serialize undefined value");
    }
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return jcsSerializeString(value);
    if (typeof value === "number") return jcsSerializeNumber(value);
    if (Array.isArray(value)) {
        if (seen.has(value)) throw new KNWFormatError("JCS: cyclic array");
        seen.add(value);
        try {
            const parts = [];
            for (let i = 0; i < value.length; i++) {
                parts.push(jcsSerialize(value[i], seen));
            }
            return "[" + parts.join(",") + "]";
        } finally {
            seen.delete(value);
        }
    }
    if (typeof value === "object") {
        if (seen.has(value)) throw new KNWFormatError("JCS: cyclic object");
        seen.add(value);
        try {
            const keys = Object.keys(value).sort();
            const parts = [];
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                const v = value[k];
                if (v === undefined) continue; // RFC 8785: undefined values are skipped (not serialised as null)
                parts.push(jcsSerializeString(k) + ":" + jcsSerialize(v, seen));
            }
            return "{" + parts.join(",") + "}";
        } finally {
            seen.delete(value);
        }
    }
    throw new KNWFormatError(`JCS: cannot serialize value of type ${typeof value}`);
}

function jcsSerializeString(s) {
    // JSON.stringify already produces JCS-compliant shortest-form output
    // for strings (raw UTF-8 for non-ASCII, \uXXXX only when shorter,
    // and the standard control-char escapes).
    return JSON.stringify(s);
}

function jcsSerializeNumber(n) {
    if (!Number.isFinite(n)) {
        throw new KNWFormatError(`JCS: non-finite number ${n}`);
    }
    if (Object.is(n, -0)) return "0"; // RFC 8785: never emit "-0"
    if (Number.isInteger(n)) return n.toString();
    // Non-integer finite number: Number.prototype.toString() already
    // returns the shortest round-trippable decimal form.
    return n.toString();
}

/**
 * Async SHA-256 hex of a UTF-8 string. Uses SubtleCrypto.
 */
async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const view = new Uint8Array(digest);
    let hex = "";
    for (let i = 0; i < view.length; i++) {
        hex += view[i].toString(16).padStart(2, "0");
    }
    return hex;
}

function computeGraphHash(graphBlock) {
    const scoped = {
        nodes: graphBlock.nodes || [],
        domains: graphBlock.domains || [],
        redirects: graphBlock.redirects || [],
    };
    return canonicalJSON(scoped);
}

function computeFileHash(metadata, graphBlock) {
    return canonicalJSON({ metadata, graph: graphBlock });
}

/**
 * Build the in-memory JSON payload with both hashes filled in.
 * Returns the payload object (with graphHash/fileHash fields).
 */
async function buildPayload(metadata, graphBlock) {
    const graphHashInput = computeGraphHash(graphBlock);
    const fileHashInput = computeFileHash(metadata, graphBlock);
    const [graphHash, fileHash] = await Promise.all([
        sha256Hex(graphHashInput),
        sha256Hex(fileHashInput),
    ]);
    return {
        metadata,
        graph: graphBlock,
        graphHash,
        fileHash,
    };
}

function splitPayload(payload) {
    return {
        metadata: payload.metadata || {},
        graph: payload.graph || {},
        graphHash: payload.graphHash || "",
        fileHash: payload.fileHash || "",
    };
}

/**
 * Encode a v1.0 .knw file (Uint8Array) from metadata + graph blocks.
 * Uses @bokuweb/zstd-wasm for the compression so the bytes are
 * byte-compatible with the Python `zstandard` encoder used on the backend.
 */
async function encodeKNW(metadata, graphBlock) {
    const payload = await buildPayload(metadata, graphBlock);
    const json = canonicalJSON(payload);
    const jsonBytes = new TextEncoder().encode(json);

    const zstd = await getZstd();
    const compressed = zstd.compress(jsonBytes);
    return assembleBlob(compressed);
}

/**
 * Decode a v1.0 .knw Uint8Array into the parsed payload object.
 * Validates magic, version, algorithm, and both hashes.
 */
async function decodeKNW(blob) {
    if (!(blob instanceof Uint8Array)) {
        throw new KNWFormatError("knw blob must be a Uint8Array");
    }
    if (blob.length < HEADER_SIZE) {
        throw new KNWFormatError("knw blob too short to contain a v1.0 header");
    }

    if (blob[0] !== MAGIC_BYTES[0] || blob[1] !== MAGIC_BYTES[1] || blob[2] !== MAGIC_BYTES[2]) {
        throw new KNWFormatError(
            `bad magic number: expected "KNW", got "${String.fromCharCode(blob[0], blob[1], blob[2])}"`
        );
    }

    const version = blob[3] | (blob[4] << 8); // little-endian uint16
    if (version !== PROTOCOL_VERSION) {
        throw new KNWFormatError(
            `unsupported protocol version ${version}; expected ${PROTOCOL_VERSION}`
        );
    }

    const algorithm = blob[5];
    if (algorithm !== COMPRESSION_ZSTD) {
        throw new KNWFormatError(
            `unsupported compression algorithm ${algorithm}; expected ${COMPRESSION_ZSTD} (zstd)`
        );
    }

    const compressed = blob.subarray(HEADER_SIZE);
    if (compressed.length === 0) {
        throw new KNWFormatError("knw payload is empty");
    }

    const zstd = await getZstd();
    let payloadBytes;
    try {
        payloadBytes = zstd.decompress(compressed);
    } catch (err) {
        throw new KNWFormatError(`zstd decompression failed: ${err.message || err}`);
    }

    let payload;
    try {
        const text = new TextDecoder("utf-8").decode(payloadBytes);
        payload = JSON.parse(text);
    } catch (err) {
        throw new KNWFormatError(`payload is not valid JSON: ${err.message || err}`);
    }

    const { metadata, graph, graphHash: declaredGraphHash, fileHash: declaredFileHash } = splitPayload(payload);

    console.log(graph, metadata);
    

    // Recompute hashes and compare.
    const expectedGraphHash = await sha256Hex(computeGraphHash(graph));
    const expectedFileHash = await sha256Hex(computeFileHash(metadata, graph));

    if (declaredGraphHash && declaredGraphHash !== expectedGraphHash) {
        throw new KNWFormatError(
            `graphHash mismatch (tampering or corruption): declared=${declaredGraphHash}, computed=${expectedGraphHash}`
        );
    }
    if (declaredFileHash && declaredFileHash !== expectedFileHash) {
        throw new KNWFormatError(
            `fileHash mismatch (tampering or corruption): declared=${declaredFileHash}, computed=${expectedFileHash}`
        );
    }

    payload.graphHash = payload.graphHash || expectedGraphHash;
    payload.fileHash = payload.fileHash || expectedFileHash;
    return payload;
}

function isKNWV10(blob) {
    if (!(blob instanceof Uint8Array) || blob.length < HEADER_SIZE) return false;
    return (
        blob[0] === MAGIC_BYTES[0] &&
        blob[1] === MAGIC_BYTES[1] &&
        blob[2] === MAGIC_BYTES[2] &&
        blob[3] === (PROTOCOL_VERSION & 0xff) &&
        blob[4] === ((PROTOCOL_VERSION >> 8) & 0xff)
    );
}

function assembleBlob(compressed) {
    const out = new Uint8Array(HEADER_SIZE + compressed.length);
    out[0] = MAGIC_BYTES[0];
    out[1] = MAGIC_BYTES[1];
    out[2] = MAGIC_BYTES[2];
    out[3] = PROTOCOL_VERSION & 0xff;
    out[4] = (PROTOCOL_VERSION >> 8) & 0xff;
    out[5] = COMPRESSION_ZSTD;
    out.set(compressed, HEADER_SIZE);
    return out;
}

window.KNWFormat = {
    MAGIC,
    PROTOCOL_VERSION,
    COMPRESSION_ZSTD,
    HEADER_SIZE,
    DEFAULT_LICENSE,
    KNWFormatError,
    encodeKNW,
    decodeKNW,
    isKNWV10,
    buildPayload,
    canonicalJSON,
    sha256Hex,
};