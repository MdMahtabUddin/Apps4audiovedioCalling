export interface TokenRequest {
  room: string;
  username: string;
}

export interface TokenResponse {
  token: string;
  error?: string;
}

export interface PermissionState {
  camera: boolean;
  microphone: boolean;
  cameraError?: string;
  microphoneError?: string;
}
