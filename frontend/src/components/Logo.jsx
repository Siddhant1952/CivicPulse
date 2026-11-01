// CivicPulse mark: a map pin whose heartbeat line says "the city's pulse", with ripples spreading from its tip.
export default function Logo({ size = 36 }) {
  return (
    <svg width={size} height={(size * 52) / 48} viewBox="0 0 48 52" role="img" aria-label="CivicPulse logo">
      <defs>
        <linearGradient id="cp-logo-g" x1="6" y1="3" x2="42" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="47" rx="19" ry="4" fill="none" stroke="url(#cp-logo-g)" strokeWidth="1.6" opacity="0.35" />
      <ellipse cx="24" cy="47" rx="11" ry="2.4" fill="none" stroke="url(#cp-logo-g)" strokeWidth="1.8" opacity="0.65" />
      <path d="M24 3C14.6 3 7 10.4 7 19.6 7 31.3 24 44 24 44s17-12.7 17-24.4C41 10.4 33.4 3 24 3Z" fill="url(#cp-logo-g)" />
      <path d="M12.5 21h6l3-8 5 15 3.5-7h5.5" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
