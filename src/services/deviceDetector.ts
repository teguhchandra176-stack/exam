import { DeviceType } from '../types';

export function detectDevice(): { type: DeviceType; details: string } {
  const ua = navigator.userAgent || '';
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const minDim = Math.min(screenWidth, screenHeight);
  const maxDim = Math.max(screenWidth, screenHeight);
  const touchPoints = navigator.maxTouchPoints || 0;

  // Modern navigator.userAgentData check if available
  const uaData = (navigator as any).userAgentData;
  const isMobileData = uaData?.mobile ?? false;

  const isIpad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && touchPoints > 1);
  const isTabletUA = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua);
  const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  if (isIpad || isTabletUA || (touchPoints > 0 && minDim >= 600 && maxDim <= 1366)) {
    return {
      type: 'Tablet',
      details: `Tablet Device (${screenWidth}x${screenHeight}, Touch: ${touchPoints}pts)`
    };
  }

  if (isMobileUA || isMobileData || (touchPoints > 0 && minDim < 600)) {
    return {
      type: 'Handphone',
      details: `Handphone Mobile (${screenWidth}x${screenHeight}, Touch: ${touchPoints}pts)`
    };
  }

  return {
    type: 'Komputer',
    details: `Komputer Desktop / Laptop (${screenWidth}x${screenHeight})`
  };
}
