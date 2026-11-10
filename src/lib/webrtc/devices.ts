export interface AvailableDevices {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
}

export async function getConnectedDevices(): Promise<AvailableDevices> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { audioInputs: [], videoInputs: [], audioOutputs: [] };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      audioInputs: devices.filter((d) => d.kind === 'audioinput'),
      videoInputs: devices.filter((d) => d.kind === 'videoinput'),
      audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
    };
  } catch (err) {
    console.warn('Error enumerating devices:', err);
    return { audioInputs: [], videoInputs: [], audioOutputs: [] };
  }
}

export async function requestMediaStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia is not supported by your browser environment.');
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}
