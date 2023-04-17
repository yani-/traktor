import crypto from 'crypto';

const IV_LENGTH = 16;
const ENCRYPTION_ALGORITHM = 'AES-256-CBC';
const CHUNK_LENGTH = 512032;

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

export async function decryptFile(decryptionKey, fileContent) {
    const arrayBuffer = await fileContent.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    let decryptedParts = Buffer.from([]);
    let bufferLength = buffer.length;

    const chunksNumber = Math.ceil(bufferLength / CHUNK_LENGTH);
    for(let i = 0; i < chunksNumber; i++ ) {
        const chunk = buffer.slice(i * CHUNK_LENGTH, (i+1) * CHUNK_LENGTH);
        const IV = chunk.slice(0, IV_LENGTH);
        const encryptedText = chunk.slice(IV_LENGTH).toString('base64')
        const res = decrypt(encryptedText, decryptionKey, IV);
        decryptedParts = Buffer.concat([decryptedParts, res]);
    }

    return decryptedParts;
}