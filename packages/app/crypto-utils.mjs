
import { webcrypto } from 'node:crypto';
const subtle = webcrypto.subtle;

function ab2hex(buf) {
  return Buffer.from(buf).toString('hex');
}

function hex2ab(hex) {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

async function generate() {
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKey = await subtle.exportKey('raw', keyPair.publicKey);
  const privateKey = await subtle.exportKey('jwk', keyPair.privateKey);

  console.log('Public Key (Hex):', ab2hex(publicKey));
  console.log('Private Key (JWK):', JSON.stringify(privateKey));
}

async function encrypt(ownerPubKeyHex, message) {
  // 1. Import Owner Public Key
  const ownerPubKey = await subtle.importKey(
    'raw',
    hex2ab(ownerPubKeyHex),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 2. Generate Ephemeral Key Pair
  const ephemeralKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // 3. Derive Shared Secret (ECDH)
  const sharedSecretBits = await subtle.deriveBits(
    { name: 'ECDH', public: ownerPubKey },
    ephemeralKeyPair.privateKey,
    256
  );

  // 4. Derive AES Key from Shared Secret
  // Simply importing the bits as a raw key for AES-GCM
  const aesKey = await subtle.importKey(
    'raw',
    sharedSecretBits,
    'AES-GCM',
    false,
    ['encrypt']
  );

  // 5. Encrypt Message
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(message);
  
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    aesKey,
    encodedMessage
  );

  // 6. Construct Output: [EphemeralPubKey (65 bytes)][IV (12 bytes)][Ciphertext]
  const ephemeralPubKeyRaw = await subtle.exportKey('raw', ephemeralKeyPair.publicKey);
  
  const output = Buffer.concat([
    Buffer.from(ephemeralPubKeyRaw),
    Buffer.from(iv),
    Buffer.from(ciphertext)
  ]);

  console.log('Encrypted Blob (Hex):', output.toString('hex'));
}

async function decrypt(ownerPrivKeyJWKStr, encryptedBlobHex) {
  const encryptedBlob = hex2ab(encryptedBlobHex);
  
  // P-256 Raw Public Key is 65 bytes (0x04 + 32 bytes X + 32 bytes Y)
  const pubKeyLen = 65;
  const ivLen = 12;
  
  const ephemeralPubKeyBytes = encryptedBlob.slice(0, pubKeyLen);
  const iv = encryptedBlob.slice(pubKeyLen, pubKeyLen + ivLen);
  const ciphertext = encryptedBlob.slice(pubKeyLen + ivLen);

  // 1. Import Ephemeral Public Key
  const ephemeralPubKey = await subtle.importKey(
    'raw',
    ephemeralPubKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 2. Import Owner Private Key
  const ownerPrivKey = await subtle.importKey(
    'jwk',
    JSON.parse(ownerPrivKeyJWKStr),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );

  // 3. Derive Shared Secret
  const sharedSecretBits = await subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPubKey },
    ownerPrivKey,
    256
  );

  // 4. Import AES Key
  const aesKey = await subtle.importKey(
    'raw',
    sharedSecretBits,
    'AES-GCM',
    false,
    ['decrypt']
  );

  // 5. Decrypt
  try {
    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      aesKey,
      ciphertext
    );

    console.log('Decrypted Message:', new TextDecoder().decode(decryptedBuffer));
  } catch (e) {
    console.error('Decryption failed:', e.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'generate') {
    await generate();
  } else if (command === 'encrypt') {
    const pubKey = args[1];
    const message = args[2];
    if (!pubKey || !message) {
      console.error('Usage: node crypto-utils.mjs encrypt <ownerPubKeyHex> <message>');
      process.exit(1);
    }
    await encrypt(pubKey, message);
  } else if (command === 'decrypt') {
    const privKey = args[1];
    const blob = args[2];
    if (!privKey || !blob) {
      console.error('Usage: node crypto-utils.mjs decrypt <ownerPrivKeyJWK> <encryptedBlobHex>');
      process.exit(1);
    }
    await decrypt(privKey, blob);
  } else {
    console.log('Usage: node crypto-utils.mjs <generate|encrypt|decrypt>');
  }
}

main().catch(console.error);
