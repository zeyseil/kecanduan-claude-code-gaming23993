interface AppLogoProps {
  className?: string;
}

/**
 * Selalu didampingi wordmark teks "Komik Tracker" di pemanggilnya —
 * alt sengaja kosong supaya screen reader tidak membacanya dua kali.
 */
export function AppLogo({ className = "h-8 w-8" }: AppLogoProps) {
  return <img src="/icon-192.png" alt="" className={`${className} rounded-lg`} />;
}
