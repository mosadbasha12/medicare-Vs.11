import * as Application from 'expo-application';

export type RemoteAppVersion = {
  versionName: string;
  versionCode: number;
  apkUrl: string;
  force?: boolean;
  notes?: string;
};

const VERSION_URL =
  'https://raw.githubusercontent.com/mosadbasha12/medicare-Vs.11/main/app-version.json';

const getCurrentVersionCode = () => {
  const nativeBuildVersion = Application.nativeBuildVersion ?? '0';
  const parsed = Number.parseInt(nativeBuildVersion, 10);

  return Number.isFinite(parsed) ? parsed : 0;
};

export const checkForAppUpdate = async (): Promise<RemoteAppVersion | null> => {
  const response = await fetch(`${VERSION_URL}?t=${Date.now()}`);

  if (!response.ok) {
    throw new Error('Could not load app version metadata');
  }

  const remoteVersion = (await response.json()) as RemoteAppVersion;
  const currentVersionCode = getCurrentVersionCode();

  if (remoteVersion.versionCode > currentVersionCode && remoteVersion.apkUrl) {
    return remoteVersion;
  }

  return null;
};
