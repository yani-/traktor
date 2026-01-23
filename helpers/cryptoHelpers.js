import crypto from 'crypto';
import pako from 'pako';
import bzip2 from "bzip2";

const IV_LENGTH = 16;
const ENCRYPTION_ALGORITHM = 'AES-256-CBC';
const CHUNK_LENGTH = 512032;
const CHUNK_SIZE_PREFIX_LENGTH = 4; // 4 bytes for compressed chunk size

const CONFIG_FILES = ['package.json', 'multisite.json'];

export function isConfigFile(fileName) {
    return CONFIG_FILES.includes(fileName);
}

export function makeKeyFromPassword(password) {
    const key = crypto
        .createHash('sha1')
        .update(password)
        .digest()
        .slice(0, IV_LENGTH);

    return Buffer.concat([key, Buffer.alloc(16)])
}

export function extractIv(base64EncryptedString) {
    return Buffer.from(base64EncryptedString, 'base64')
        .slice(0, IV_LENGTH)
}

export function extractEncryptedText(base64EncryptedString) {
    return Buffer.from(base64EncryptedString, 'base64')
        .slice(IV_LENGTH)
        .toString('base64');
}

export function decrypt(cipherText, key, iv) {
    cipherText = Buffer.from(cipherText.replace('-', '+').replace('_', '/'), 'base64');
    const cipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, {});
    return Buffer.concat([cipher.update(cipherText), cipher.final()]);
}

/**
 * Decompresses a chunk based on compression type
 * @param {Buffer} compressedChunk - Compressed chunk data
 * @param {string} compressionType - 'zlib' or 'bzip2'
 * @returns {Buffer} Decompressed chunk data
 */
function decompressChunk(compressedChunk, compressionType) {
    const uint8Array = compressedChunk instanceof Uint8Array ? compressedChunk : new Uint8Array(compressedChunk);

    if (compressionType === 'zlib') {
        try {
            const decompressed = pako.inflate(uint8Array);
            return Buffer.from(decompressed);
        } catch (e) {
            const msg = e?.message || String(e);
            throw new Error(
                `zlib decompression failed: ${msg} (chunk size: ${compressedChunk.length} bytes)`
            );
        }
    }

    if (compressionType === 'bzip2') {
        try {
            const bitstream = bzip2.array(uint8Array);
            const decompressedString = bzip2.simple(bitstream);

            return Buffer.from(decompressedString, 'binary');
        } catch (e) {
            const msg = e?.message || String(e);
            throw new Error( `bzip2 decompression failed: ${msg} (chunk size: ${compressedChunk.length} bytes)` );
        }
    }

    throw new Error(`Unsupported compression type: ${compressionType}`);
}

async function processChunk(rawChunk, options) {
    const { isEncrypted, isCompressed, compressionType, decryptionKey, fileName } = options;

    if (isConfigFile(fileName)) {
        return rawChunk;
    }

    let chunk = rawChunk;
    if (isEncrypted && decryptionKey) {
        if (chunk.length < IV_LENGTH) {
            throw new Error(`Chunk too small to contain IV: ${chunk.length} < ${IV_LENGTH}`);
        }
        try {
            const IV = chunk.slice(0, IV_LENGTH);
            const encryptedData = chunk.slice(IV_LENGTH);
            if (encryptedData.length === 0) {
                throw new Error('Encrypted data is empty after extracting IV');
            }
            const encryptedText = encryptedData.toString('base64');
            chunk = decrypt(encryptedText, decryptionKey, IV);
        } catch (error) {
            throw new Error(`Decryption failed: ${error?.message || error?.toString() || String(error)}`);
        }
    }

    if (isCompressed && compressionType) {
        try {
            if (chunk.length === 0) throw new Error('Cannot decompress empty chunk');
            if (compressionType === 'zlib' && chunk.length < 2) {
                throw new Error(`Chunk too small for zlib decompression: ${chunk.length} bytes`);
            }
            if (compressionType === 'bzip2' && chunk.length < 10) {
                throw new Error(`Chunk too small for bzip2 decompression: ${chunk.length} bytes`);
            }

            chunk = await decompressChunk(chunk, compressionType);
        } catch (error) {
            const errorMsg = error?.message || error?.toString() || String(error);
            throw new Error(`Decompression failed: ${errorMsg} (chunk size: ${chunk.length} bytes, compression type: ${compressionType})`);
        }
    }

    return chunk;
}

/**
 * Decrypts and/or decompresses file content
 * @param {Buffer} decryptionKey - Decryption key (if encrypted)
 * @param {Blob|ArrayBuffer} fileContent - File content from archive
 * @param {Object} options - Processing options
 * @param {boolean} options.isEncrypted - Whether file is encrypted
 * @param {boolean} options.isCompressed - Whether file is compressed
 * @param {string} options.compressionType - 'zlib' or 'bzip2' (if compressed)
 * @param {string} options.fileName - Name of the file (for config file detection)
 * @returns {Promise<Buffer>} Processed file content
 */
export async function decryptFile(decryptionKey, fileContent, options = {}) {
    const {
        isEncrypted = false,
        isCompressed = false,
        compressionType = null,
        fileName = ''
    } = options;

    const arrayBuffer = await fileContent.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    
    let processedParts = Buffer.from([]);
    let bufferLength = buffer.length;
    let position = 0;

    while (position < bufferLength) {
        let rawChunk = null;
        const chunkStartPosition = position;
        let chunkSize = 0;
        
        if (isCompressed) {
            if (position + CHUNK_SIZE_PREFIX_LENGTH > bufferLength) {
                if (position < bufferLength) {
                    throw new Error(`Incomplete chunk size prefix at position ${position}, remaining bytes: ${bufferLength - position}`);
                }
                break;
            }

            chunkSize = buffer.readUInt32BE(position);
            position += CHUNK_SIZE_PREFIX_LENGTH;

            if (chunkSize === 0) {
                throw new Error(`Invalid compressed chunk size: 0 at position ${position - CHUNK_SIZE_PREFIX_LENGTH}`);
            }
            
            const remainingBytes = bufferLength - position;
            if (chunkSize > remainingBytes) {
                throw new Error(`Compressed chunk size (${chunkSize}) exceeds remaining buffer (${remainingBytes}) at position ${position}`);
            }

            rawChunk = buffer.slice(position, position + chunkSize);
            position += chunkSize;
        } else {
            chunkSize = Math.min(CHUNK_LENGTH, bufferLength - position);
            rawChunk = buffer.slice(position, position + chunkSize);
            position += chunkSize;
        }

        try {
            const processed = await processChunk(rawChunk, {
                isEncrypted,
                isCompressed,
                compressionType,
                decryptionKey,
                fileName
            });
            processedParts = Buffer.concat([processedParts, processed]);
        } catch (error) {
            const errorMessage = error?.message || error?.toString() || String(error) || 'Unknown error';
            throw new Error(`Error processing chunk at offset ${chunkStartPosition}: ${errorMessage}`);
        }
    }
    
    return processedParts;
}