import React from 'react';

export const BrandMark = ({
  className = 'h-5 w-5',
}: {
  className?: string;
}) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect fill="currentColor" fillOpacity="0.08" height="52" rx="10" width="52" x="6" y="6" />
    <path
      d="M16 22C20 24.6 24 24.6 28 22C32 19.4 36 19.4 40 22C44 24.6 48 24.6 48 24.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="4.5"
    />
    <path
      d="M16 32C20 34.6 24 34.6 28 32C32 29.4 36 29.4 40 32C44 34.6 48 34.6 48 34.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="4.5"
    />
    <path
      d="M16 42C20 44.6 24 44.6 28 42C32 39.4 36 39.4 40 42C44 44.6 48 44.6 48 44.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="4.5"
    />
  </svg>
);
