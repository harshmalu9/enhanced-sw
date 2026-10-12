export const Colors = {
  // Brand
  primary: "#064E3B", // Emerald Ink
  primaryContainer: "#E6F4EA", // Deep Emerald Light
  onPrimary: "#FFFFFF",
  onPrimaryContainer: "#064E3B",

  secondary: "#F8E7C9", // Champagne
  secondaryContainer: "#FDF6E9", // Light Champagne
  onSecondary: "#3D2E05",
  onSecondaryContainer: "#543E08",

  // Neutrals & Surfaces
  background: "#F8F9FA",
  surface: "#FFFFFF",
  surfaceVariant: "#F1F3F5",
  surfaceContainerHigh: "#E9ECEF",
  outline: "#E2E8F0",
  outlineVariant: "#CBD5E1",

  // Typography
  primaryText: "#0F172A",
  secondaryText: "#5A6A80",
  tertiaryText: "#94A3B8",

  // Semantic
  success: "#047857",
  successContainer: "#D1FAE5",
  warning: "#B45309",
  warningContainer: "#FEF3C7",
  error: "#B91C1C",
  errorContainer: "#FEE2E2",

  // Ripple feedback
  ripple: "rgba(6, 78, 59, 0.12)",
  rippleNeutral: "rgba(15, 23, 42, 0.08)",
  rippleLight: "rgba(255, 255, 255, 0.2)",
};

export const Typography = {
  headlineLarge: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.primaryText,
    letterSpacing: -0.5,
  },
  headlineMedium: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.primaryText,
    letterSpacing: -0.3,
  },
  titleLarge: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.primaryText,
  },
  titleMedium: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.primaryText,
  },
  titleSmall: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.primaryText,
  },
  bodyLarge: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: Colors.primaryText,
    lineHeight: 22,
  },
  bodyMedium: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: Colors.secondaryText,
    lineHeight: 18,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: Colors.secondaryText,
    lineHeight: 16,
  },
  labelLarge: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.primaryText,
  },
  labelMedium: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.secondaryText,
    letterSpacing: 0.3,
  },
  labelSmall: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.secondaryText,
    letterSpacing: 0.5,
  },
  amountLarge: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.primaryText,
  },
  amountMedium: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.primaryText,
  },
};

export const Elevation = {
  level0: {
    elevation: 0,
    shadowOpacity: 0,
  },
  level1: {
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  level2: {
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  level3: {
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
};

export const Shapes = {
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 14,
  radiusXl: 20,
  radiusFull: 9999,
};
