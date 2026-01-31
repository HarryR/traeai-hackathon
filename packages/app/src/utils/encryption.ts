
function hex2ab(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
}

function ab2hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function encryptMessage(ownerPubKeyHex: string, message: string): Promise<string> {
  // Use window.crypto in the browser
  const subtle = window.crypto.subtle;

  // 1. Import Owner Public Key
  const ownerPubKey = await subtle.importKey(
    'raw',
    hex2ab(ownerPubKeyHex) as any,
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
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(message);
  
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    aesKey,
    encodedMessage
  );

  // 6. Construct Output: [EphemeralPubKey (65 bytes)][IV (12 bytes)][Ciphertext]
  const ephemeralPubKeyRaw = await subtle.exportKey('raw', ephemeralKeyPair.publicKey);
  
  // Combine buffers (equivalent to Buffer.concat)
  const ephemeralPubKeyBytes = new Uint8Array(ephemeralPubKeyRaw);
  const ciphertextBytes = new Uint8Array(ciphertext);
  
  const output = new Uint8Array(ephemeralPubKeyBytes.length + iv.length + ciphertextBytes.length);
  output.set(ephemeralPubKeyBytes, 0);
  output.set(iv, ephemeralPubKeyBytes.length);
  output.set(ciphertextBytes, ephemeralPubKeyBytes.length + iv.length);

  return ab2hex(output.buffer);
}
