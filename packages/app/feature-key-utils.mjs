import { secp256k1 } from '@noble/curves/secp256k1';
import { getAddress, keccak256, toUtf8Bytes } from 'ethers';

const SECP256K1_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

function normalizeHex(value) {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

function hexToBytes(hex) {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

function hashFeatureIdToScalar(featureId) {
  const digest = keccak256(toUtf8Bytes(featureId));
  const scalar = BigInt(digest) % SECP256K1_ORDER;
  return scalar === 0n ? 1n : scalar;
}

function deriveAddressFromPoint(uncompressedPoint) {
  const hash = keccak256(uncompressedPoint.slice(1));
  return getAddress(`0x${hash.slice(-40)}`);
}

function generate() {
  const privateKeyBytes = secp256k1.utils.randomPrivateKey();
  const privateKeyHex = bytesToHex(privateKeyBytes);
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false);
  const publicKeyHex = bytesToHex(publicKeyBytes);

  console.log('Private Key (Hex):', privateKeyHex);
  console.log('Public Key (Hex):', publicKeyHex);
  console.log('Address:', deriveAddressFromPoint(publicKeyBytes));
}

function derive(featureId, ownerPrivateKeyHex) {
  const normalized = normalizeHex(ownerPrivateKeyHex);
  const ownerScalar = BigInt(`0x${normalized}`);
  const featureScalar = hashFeatureIdToScalar(featureId);
  const derivedScalar = (ownerScalar * featureScalar) % SECP256K1_ORDER;
  const safeScalar = derivedScalar === 0n ? 1n : derivedScalar;
  const derivedHex = safeScalar.toString(16).padStart(64, '0');
  const derivedBytes = hexToBytes(derivedHex);
  const derivedPublic = secp256k1.getPublicKey(derivedBytes, false);

  console.log('Feature ID:', featureId);
  console.log('Derived Private Key (Hex):', derivedHex);
  console.log('Derived Public Key (Hex):', bytesToHex(derivedPublic));
  console.log('Derived Address:', deriveAddressFromPoint(derivedPublic));
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'generate') {
    generate();
    return;
  }

  if (command === 'derive') {
    const featureId = args[1];
    const privateKey = args[2];
    if (!featureId || !privateKey) {
      console.error('Usage: node feature-key-utils.mjs derive <featureId> <ownerPrivateKeyHex>');
      process.exit(1);
    }
    derive(featureId, privateKey);
    return;
  }

  console.log('Usage: node feature-key-utils.mjs <generate|derive>');
}

main();
