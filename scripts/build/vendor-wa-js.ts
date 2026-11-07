// WA-JS (Apache-2.0) is bundled unchanged except for one line, rewritten here when the build copies it.
//
// Its file-type detection has a helper for Node.js streams that loads Node's "stream" module with
// eval("require"). In a browser `require` doesn't exist, so that eval throws a ReferenceError; the
// helper is only reached when given a Node stream, which never happens here. Firefox Add-ons flags
// any eval, so the call is replaced with a throw of the same error: behaviour is unchanged.

export const NODE_ONLY_EVAL = 'eval("require")("stream")';
const REPLACEMENT = '(()=>{throw new ReferenceError("require is not defined")})()';
const NOTICE =
  "/*! Modified by wa-export: a Node-only dynamic require (via eval) is replaced with the ReferenceError it throws in a browser; see scripts/build/vendor-wa-js.ts */";

/**
 * Return WA-JS's bundle with the Node-only eval replaced and a modification notice under its license
 * line (Apache-2.0 section 4b). Throws unless the eval occurs exactly once, so a WA-JS upgrade that
 * moves or adds one fails the build instead of shipping it.
 */
export function vendorWaJs(source: string): string {
  const count = source.split(NODE_ONLY_EVAL).length - 1;
  if (count !== 1) throw new Error(`WA-JS: expected exactly 1 ${NODE_ONLY_EVAL}, found ${count}. Review the new WA-JS and update scripts/build/vendor-wa-js.ts.`);
  const newline = source.indexOf("\n");
  const [license, rest] = newline === -1 ? ["", source] : [source.slice(0, newline), source.slice(newline + 1)];
  return `${license}\n${NOTICE}\n${rest.replace(NODE_ONLY_EVAL, REPLACEMENT)}`;
}
