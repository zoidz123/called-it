export type PurgeConfirmationOptions = {
  input?: NodeJS.ReadableStream & { isTTY?: boolean }
  output?: NodeJS.WritableStream & { isTTY?: boolean }
}

export function confirmPurge(options?: PurgeConfirmationOptions): Promise<void>
