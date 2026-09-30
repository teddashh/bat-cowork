// Local stub. The imported renderer calls this helper, but the upstream
// shared/transfer-redaction.mjs file was not part of the BAT renderer copy.
// This is not the original BAT implementation.

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/g,
  /\bsk-ant-[A-Za-z0-9_\-]+/g,
  /\bsk-[A-Za-z0-9]{20,}/g,
  /\bghp_[A-Za-z0-9]+/g,
  /\bgithub_pat_[A-Za-z0-9_]+/g,
  /\bxox[baprs]-[A-Za-z0-9\-]+/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
]

export function redactTransferSecrets(text) {
  const input = typeof text === 'string' ? text : ''
  let count = 0
  let out = input
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, () => {
      count += 1
      return '[redacted]'
    })
  }
  return { text: out, count }
}
