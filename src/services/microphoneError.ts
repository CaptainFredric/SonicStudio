export const microphoneErrorMessage = (error: unknown): string => {
  const name = error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was blocked. Allow microphone access for this site in your browser settings, then try again.';
    case 'NotFoundError':
      return 'No microphone was found. Connect a microphone or select an available input in your system settings.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The microphone could not start. Close other apps using it, check your system input, then try again.';
    default:
      return error instanceof Error ? error.message : 'Could not access the microphone. Check your system input and try again.';
  }
};
