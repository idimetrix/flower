"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicKeyToBytes = publicKeyToBytes;
exports.bytesToPublicKey = bytesToPublicKey;
exports.generateSharedKey = generateSharedKey;
exports.computeHMAC = computeHMAC;
const elliptic_1 = require("elliptic");
const crypto = __importStar(require("crypto"));
const ec = new elliptic_1.ec("p256");
// Convert public key to bytes
function publicKeyToBytes(key) {
    return Buffer.from(key.getPublic("array"));
}
// Convert bytes back to a public key
function bytesToPublicKey(bytes) {
    return ec.keyFromPublic(bytes);
}
// Generate shared key between private and public keys
function generateSharedKey(privateKey, publicKey) {
    return Buffer.from(privateKey.derive(publicKey.getPublic()).toArray());
}
// Compute HMAC using shared key and data
function computeHMAC(key, message) {
    return crypto.createHmac("sha256", key).update(message).digest();
}
