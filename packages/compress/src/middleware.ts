import type { Get, UniversalMiddleware } from "@universal-middleware/core";
import { EncodingGuesser } from "./compress";
import { handleCompression } from "./response";
import type { CompressionOptions } from "./types";

const compressMiddleware = ((options?: CompressionOptions) => (request) => {
  const guesser = new EncodingGuesser(request);
  let disabled = false;

  if (typeof CompressionStream === "undefined") {
    console.warn("Your platform does not support CompressionStream. Compression is disabled");
    disabled = true;
  }

  return function universalMiddlewareCompress(response) {
    const encoding = guesser.guessEncoding(response);

    if (disabled || !encoding) return response;

    return handleCompression(encoding, response, options);
  };
}) satisfies Get<[options: CompressionOptions], UniversalMiddleware>;

// export default is mandatory
export default compressMiddleware;
