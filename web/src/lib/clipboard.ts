/**
 * Copies text to the clipboard; resolves false where the Clipboard API is missing or denied
 * (insecure origins, some embedded views) so the caller can say so instead of failing quietly.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
