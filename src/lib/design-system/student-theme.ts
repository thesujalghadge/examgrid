export const studentTheme = {
  colors: {
    background: "bg-[#FAFAFA] dark:bg-[#0F0F0F]",
    surface: "bg-[#FFFFFF] dark:bg-[#1A1A1A]",
    border: "border-gray-200 dark:border-[#2A2A2A]",
    borderSoft: "border-gray-100 dark:border-[#222222]",
    textPrimary: "text-[#111827] dark:text-[#F9FAFB]",
    textSecondary: "text-[#6B7280] dark:text-[#9CA3AF]",
    textTertiary: "text-[#9CA3AF] dark:text-[#6B7280]",
    
    accent: "bg-[#4F46E5] text-white dark:bg-[#818CF8]",
    accentText: "text-[#4F46E5] dark:text-[#818CF8]",
    accentLight: "bg-[#EEF2FF] text-[#4F46E5] dark:bg-[#312E81] dark:text-[#818CF8]",
    
    success: "text-[#059669] dark:text-[#34D399]",
    successBg: "bg-[#D1FAE5] dark:bg-[#064E3B]",
    warning: "text-[#D97706] dark:text-[#FBBF24]",
    danger: "text-[#DC2626] dark:text-[#F87171]",
    dangerBg: "bg-[#FEE2E2] dark:bg-[#7F1D1D]",
  },
  
  typography: {
    h1: "font-sans text-2xl font-bold leading-[1.3]",
    h2: "font-sans text-xl font-semibold leading-[1.35]",
    h3: "font-sans text-base font-semibold leading-[1.4]",
    body: "font-sans text-sm font-normal leading-[1.5]",
    bodySmall: "font-sans text-[13px] font-normal leading-[1.5]",
    caption: "font-sans text-xs font-normal leading-[1.5]",
    metric: "font-sans text-[28px] font-bold leading-[1.1]",
    metricSmall: "font-sans text-xl font-semibold leading-[1.2]",
    
    mono: "font-mono", // For scores, times, ranks
  },

  radius: {
    small: "rounded-md", // 6px approx
    medium: "rounded-xl", // 12px
    large: "rounded-2xl", // 16px
    full: "rounded-full",
  },

  elevation: {
    rest: "shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] border border-gray-100 dark:border-[#2A2A2A]", 
    hover: "hover:shadow-md hover:-translate-y-0.5", 
    floating: "shadow-xl border border-gray-100 dark:border-[#2A2A2A]", 
  },

  transitions: {
    fast: "transition-all duration-150 ease-out",
    medium: "transition-all duration-200 ease-out",
    slow: "transition-all duration-300 ease-in-out",
  },

  layout: {
    container: "mx-auto max-w-7xl px-4 md:px-6 lg:px-8",
    sectionGap: "space-y-8 md:space-y-12",
  }
};
