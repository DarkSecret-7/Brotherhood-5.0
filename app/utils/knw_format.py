# This file is part of The Brotherhood Project
#
# Copyright (C) 2026  The Brotherhood Project Developers
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""
.knw file format - Protocol Version 1.0

Binary layout:

    Offset  Size          Field
    ------  ------------  ------------------------------------------------
    0       3 bytes       Magic bytes: ASCII "KNW"
    3       2 bytes       Protocol version: uint16 little-endian (1 for v1.0)
    5       1 byte        Compression algorithm (1 = zstd)
    6       N bytes       Compressed payload (zstd)

The decompressed payload is a UTF-8 JSON document with the following
structure:

    {
        "metadata": {
            "uuid":               "<graph public uuid, or null>",
            "version_label":      "<graph version label>",
            "base_uuid":          "<parent graph uuid, or null>",
            "base_version_label": "<parent graph version label, or null>",
            "author":             "<username of the exporting user>",
            "license":            { "name": "CC-BY-SA-4.0", "url": "https://creativecommons.org/licenses/by-sa/4.0/" },
            "created":            "<ISO-8601 timestamp>",
            "last_updated":       "<ISO-8601 timestamp>"
        },
        "graph": {
            "public_uuid":        "...",
            "base_uuid":          "..." | null,
            "version_label":      "...",
            "base_graph_label":   "..." | null,
            "created_at":         "...",
            "last_updated":       "...",
            "authors":            [ { "user_uuid": "...", "username": "..." } ],
            "nodes":              [ ... ],
            "domains":            [ ... ],
            "redirects":          [ ... ]
        },
        "graphHash": "<lowercase hex SHA-256 of canonical(graph)>",
        "fileHash":  "<lowercase hex SHA-256 of canonical({metadata, graph})>"
    }

Hash canonicalization:
    - The payload is canonicalized with **RFC 8785 (JCS)** via the `jcs`
      package, after collapsing whole-valued floats to ints (so `1.0` and
      `1` serialize identically to the JavaScript frontend, which collapses
      them at the IEEE 754 layer).
    - `graphHash` is computed over the canonical bytes of the `graph`
      block only (`nodes`, `domains`, `redirects`).
    - `fileHash`  is computed over the canonical bytes of a temporary
      object containing `metadata` and `graph` (the hash fields themselves
      are excluded from the input).
    - Both implementations (Python backend, JS frontend) MUST agree on
      the canonical bytes for the same input — this is the byte-for-byte
      contract that lets files round-trip across pipelines.
"""

import hashlib
import json
import struct
from typing import Any, Dict, Tuple

try:
    import zstandard as zstd
except ImportError:  # pragma: no cover - zstandard is a hard dependency
    zstd = None

try:
    import jcs as _jcs
except ImportError:  # pragma: no cover - jcs is a hard dependency
    _jcs = None


# --- Protocol constants -----------------------------------------------------

MAGIC = b"KNW"
PROTOCOL_VERSION = 1
COMPRESSION_ZSTD = 1

HEADER_SIZE = 3 + 2 + 1  # magic(3) + version(2) + algorithm(1) = 6 bytes

# Default license bundled with every exported graph. The url points to the
# canonical Creative Commons page for CC-BY-SA-4.0.
DEFAULT_LICENSE = {
    "name": "CC-BY-SA-4.0",
    "url": "https://creativecommons.org/licenses/by-sa/4.0/",
}

# Magic-number based check, exposed for fast pre-validation.
_MAGIC_INT = int.from_bytes(MAGIC, "big")


# --- Errors -----------------------------------------------------------------

class KNWFormatError(Exception):
    """Raised when an input cannot be decoded as a valid v1.0 .knw file."""


# --- Hashing helpers --------------------------------------------------------

def _normalize_numbers(obj: Any) -> Any:
    """Collapse whole-valued floats to ints so that 1.0 and 1 serialize identically.

    JavaScript represents 1.0 and 1 as the same IEEE 754 double and JSON.stringify
    emits the shortest form ("1"). Python distinguishes float from int, so we
    normalise here to keep the canonical output byte-identical to the frontend.
    """
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, float):
        return int(obj) if obj.is_integer() and not (obj != obj or obj == float("inf") or obj == float("-inf")) else obj
    if isinstance(obj, dict):
        return {k: _normalize_numbers(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_normalize_numbers(v) for v in obj]
    return obj


def _canonical_json_bytes(obj: Any) -> bytes:
    """Serialize `obj` to deterministic UTF-8 JSON bytes for hashing (RFC 8785)."""
    if _jcs is None:
        raise KNWFormatError("jcs is required for .knw v1.0 canonicalization")
    return _jcs.canonicalize(_normalize_numbers(obj))


def sha256_hex(data: bytes) -> str:
    """Return lowercase hex SHA-256 of `data`."""
    return hashlib.sha256(data).hexdigest()


def compute_graph_hash(graph_block: Dict[str, Any]) -> str:
    """Hash of the canonical `graph` block (nodes + domains + redirects)."""
    scoped = {
        "nodes": graph_block.get("nodes", []),
        "domains": graph_block.get("domains", []),
        "redirects": graph_block.get("redirects", []),
    }
    return sha256_hex(_canonical_json_bytes(scoped))


def compute_file_hash(metadata: Dict[str, Any], graph_block: Dict[str, Any]) -> str:
    """Hash of canonical {metadata, graph} - excludes the hash fields."""
    return sha256_hex(_canonical_json_bytes({"metadata": metadata, "graph": graph_block}))


# --- Build / parse helpers --------------------------------------------------

def build_payload(metadata: Dict[str, Any], graph_block: Dict[str, Any]) -> Dict[str, Any]:
    """Build the in-memory JSON payload with hashes filled in."""
    return {
        "metadata": metadata,
        "graph": graph_block,
        "graphHash": compute_graph_hash(graph_block),
        "fileHash": compute_file_hash(metadata, graph_block),
    }


def split_payload(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any], str, str]:
    """Split a decoded payload into (metadata, graph, graphHash, fileHash)."""
    metadata = payload.get("metadata") or {}
    graph = payload.get("graph") or {}
    graph_hash = payload.get("graphHash", "")
    file_hash = payload.get("fileHash", "")
    return metadata, graph, graph_hash, file_hash


# --- Encoding / decoding ----------------------------------------------------

def encode_knw(metadata: Dict[str, Any], graph_block: Dict[str, Any],
               compression_level: int = 3) -> bytes:
    """Encode a v1.0 .knw file from metadata + graph blocks.

    Returns the complete binary blob (header + compressed payload).
    """
    if zstd is None:
        raise KNWFormatError("zstandard is required for .knw v1.0 encoding")

    payload = build_payload(metadata, graph_block)
    payload_bytes = _canonical_json_bytes(payload)

    compressor = zstd.ZstdCompressor(level=compression_level)
    compressed = compressor.compress(payload_bytes)

    header = MAGIC + struct.pack("<H", PROTOCOL_VERSION) + bytes([COMPRESSION_ZSTD])
    return header + compressed


def decode_knw(blob: bytes) -> Dict[str, Any]:
    """Decode a v1.0 .knw blob and return the parsed JSON payload.

    Validates the magic number, version, compression algorithm, and the
    embedded hashes. Raises `KNWFormatError` on any mismatch.
    """
    if zstd is None:
        raise KNWFormatError("zstandard is required for .knw v1.0 decoding")

    if not isinstance(blob, (bytes, bytearray)):
        raise KNWFormatError("knw blob must be raw bytes")
    if len(blob) < HEADER_SIZE:
        raise KNWFormatError("knw blob too short to contain a v1.0 header")

    magic = bytes(blob[:3])
    if magic != MAGIC:
        raise KNWFormatError(
            f"bad magic number: expected {MAGIC!r}, got {magic!r}"
        )

    version = struct.unpack("<H", bytes(blob[3:5]))[0]
    if version != PROTOCOL_VERSION:
        raise KNWFormatError(
            f"unsupported protocol version {version}; expected {PROTOCOL_VERSION}"
        )

    algorithm = blob[5]
    if algorithm != COMPRESSION_ZSTD:
        raise KNWFormatError(
            f"unsupported compression algorithm {algorithm}; expected {COMPRESSION_ZSTD} (zstd)"
        )

    compressed = bytes(blob[HEADER_SIZE:])
    if not compressed:
        raise KNWFormatError("knw payload is empty")

    try:
        decompressor = zstd.ZstdDecompressor()
        payload_bytes = decompressor.decompress(compressed)
    except zstd.ZstdError as exc:  # pragma: no cover - depends on zstd internals
        raise KNWFormatError(f"zstd decompression failed: {exc}") from exc

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise KNWFormatError(f"payload is not valid JSON: {exc}") from exc

    metadata, graph, declared_graph_hash, declared_file_hash = split_payload(payload)

    # Recompute and verify hashes. A mismatch means the file was tampered with
    # or corrupted in transit.
    expected_graph_hash = compute_graph_hash(graph)
    expected_file_hash = compute_file_hash(metadata, graph)

    if declared_graph_hash and declared_graph_hash != expected_graph_hash:
        raise KNWFormatError(
            f"graphHash mismatch (tampering or corruption): declared="
            f"{declared_graph_hash}, computed={expected_graph_hash}"
        )
    if declared_file_hash and declared_file_hash != expected_file_hash:
        raise KNWFormatError(
            f"fileHash mismatch (tampering or corruption): declared="
            f"{declared_file_hash}, computed={expected_file_hash}"
        )

    # Fill in hashes if the file omitted them so callers always get them.
    payload.setdefault("graphHash", expected_graph_hash)
    payload.setdefault("fileHash", expected_file_hash)
    return payload


def is_knw_v10(blob: bytes) -> bool:
    """Cheap pre-check: does this blob start with the v1.0 magic + version?"""
    if not isinstance(blob, (bytes, bytearray)) or len(blob) < HEADER_SIZE:
        return False
    return bytes(blob[:3]) == MAGIC and blob[3:5] == struct.pack("<H", PROTOCOL_VERSION)