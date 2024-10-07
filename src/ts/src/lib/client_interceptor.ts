import { ec as EC } from "elliptic";
import {
  MethodInfo,
  RpcMetadata,
  UnaryCall,
  NextUnaryFn,
  RpcOptions,
  RpcInterceptor,
} from "@protobuf-ts/runtime-rpc";
import {
  computeHMAC,
  bytesToPublicKey,
  publicKeyToBytes,
  generateSharedKey,
} from "./crypto_helpers";

export const PUBLIC_KEY_HEADER = "public-key";
export const AUTH_TOKEN_HEADER = "auth-token";

// Helper function to extract values from metadata
function getValueFromMetadata(key: string, metadata: RpcMetadata): string {
  const values = metadata[key];
  return values.length > 0 && typeof values[0] === "string" ? values[0] : "";
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64") // Standard Base64 encoding
    .replace(/\+/g, "-") // Replace + with -
    .replace(/\//g, "_") // Replace / with _
    .replace(/=+$/, ""); // Remove padding (trailing = characters)
}

export function AuthenticateClientInterceptor(
  privateKey: EC.KeyPair,
  publicKey: EC.KeyPair,
): RpcInterceptor {
  let sharedSecret: Buffer | null = null;
  let serverPublicKey: EC.KeyPair | null = null;

  // Convert the public key to bytes and encode it
  const encodedPublicKey = base64UrlEncode(publicKeyToBytes(publicKey));

  return {
    interceptUnary(
      next: NextUnaryFn,
      method: MethodInfo,
      input: object,
      options: RpcOptions,
    ): UnaryCall {
      // Manipulate metadata before sending the request
      const metadata: RpcMetadata = options.meta || {};

      // Always add the public key to the metadata
      metadata[PUBLIC_KEY_HEADER] = encodedPublicKey;

      const postprocess = "pingInterval" in input;

      // Add HMAC to metadata if a shared secret exists
      if (sharedSecret !== null) {
        // Assuming the message is already serialized and available at this point
        const serializedMessage = method.I.toBinary(input);
        const hmac = computeHMAC(sharedSecret, Buffer.from(serializedMessage));
        metadata[AUTH_TOKEN_HEADER] = base64UrlEncode(hmac);
      }

      const continuation = next(method, input, { ...options, meta: metadata });
      if (postprocess) {
        handlePostprocess(metadata);
      }
      return continuation;
    },
  };

  function handlePostprocess(metadata: RpcMetadata): void {
    const serverPublicKeyBytes = getValueFromMetadata(PUBLIC_KEY_HEADER, metadata);

    if (serverPublicKeyBytes.length > 0) {
      serverPublicKey = bytesToPublicKey(Buffer.from(serverPublicKeyBytes));
    } else {
      console.warn("Couldn't get server public key, server may be offline");
    }

    if (serverPublicKey) {
      sharedSecret = generateSharedKey(privateKey, serverPublicKey);
    }
  }
}
