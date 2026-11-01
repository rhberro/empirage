import { createSystem, defaultConfig, defineConfig, defineRecipe } from "@chakra-ui/react";

const buttonRecipeOptions = {
  base: {
    borderRadius: "sm",
    fontFamily: "ui",
    fontWeight: "bold",
    letterSpacing: "wide",
    textTransform: "uppercase",
    transition: "background 120ms ease-out, border-color 120ms ease-out",
  },
  defaultVariants: {
    size: "md",
    variant: "solid",
  },
  variants: {
    size: {
      lg: {
        fontSize: "md",
        minH: "12",
        px: "6",
      },
      md: {
        fontSize: "sm",
        minH: "10",
        px: "4",
      },
      sm: {
        fontSize: "xs",
        minH: "8",
        px: "3",
      },
    },
    variant: {
      ghost: {
        _hover: {
          bg: "surface.raised",
          color: "fg.default",
        },
        bg: "transparent",
        color: "fg.muted",
      },
      outline: {
        _hover: {
          bg: "surface.raised",
          borderColor: "brand.solid",
          color: "brand.emphasized",
        },
        bg: "transparent",
        borderColor: "border.emphasized",
        borderWidth: "1px",
        color: "fg.default",
      },
      solid: {
        _hover: {
          bg: "brand.emphasized",
          borderColor: "brand.emphasized",
        },
        bg: "brand.solid",
        borderColor: "brand.solid",
        borderWidth: "1px",
        color: "brand.contrast",
      },
    },
  },
} as const;

const inputRecipeOptions = {
  base: {
    _focusVisible: {
      borderColor: "accent.solid",
      boxShadow: "0 0 0 1px var(--chakra-colors-accent-solid)",
    },
    _placeholder: {
      color: "fg.subtle",
    },
    bg: "surface.sunken",
    borderColor: "border.default",
    borderRadius: "sm",
    color: "fg.default",
    fontFamily: "body",
  },
} as const;

const buttonRecipe = defineRecipe(buttonRecipeOptions);
const inputRecipe = defineRecipe(inputRecipeOptions);

const themeConfig = {
  strictTokens: true,
  theme: {
    recipes: {
      button: buttonRecipe,
      input: inputRecipe,
    },
    semanticTokens: {
      colors: {
        "accent.contrast": { value: "{colors.neutral.950}" },
        "accent.emphasized": { value: "{colors.blue.400}" },
        "accent.solid": { value: "{colors.blue.500}" },
        "bg.canvas": { value: "{colors.neutral.950}" },
        "border.default": { value: "{colors.neutral.600}" },
        "border.emphasized": { value: "{colors.brand.200}" },
        "brand.contrast": { value: "{colors.neutral.950}" },
        "brand.emphasized": { value: "{colors.brand.100}" },
        "brand.solid": { value: "{colors.brand.200}" },
        "experience.fill": { value: "{colors.green.500}" },
        "fg.default": { value: "{colors.neutral.50}" },
        "fg.muted": { value: "{colors.neutral.200}" },
        "fg.subtle": { value: "{colors.neutral.300}" },
        "health.fill": { value: "{colors.red.500}" },
        "mana.fill": { value: "{colors.blue.500}" },
        "status.danger": { value: "{colors.red.500}" },
        "status.info": { value: "{colors.blue.500}" },
        "status.success": { value: "{colors.green.500}" },
        "status.warning": { value: "{colors.yellow.500}" },
        "surface.panel": { value: "{colors.neutral.800}" },
        "surface.raised": { value: "{colors.neutral.700}" },
        "surface.sunken": { value: "{colors.neutral.950}" },
      },
    },
    tokens: {
      colors: {
        blue: {
          400: { value: "#28D7C8" },
          500: { value: "#0AC8B9" },
          600: { value: "#079A9A" },
          700: { value: "#087A86" },
        },
        brand: {
          100: { value: "#D8C69B" },
          200: { value: "#C8AA6E" },
          300: { value: "#B08D57" },
          400: { value: "#8A6C3A" },
          50: { value: "#F0E6D2" },
          500: { value: "#6F552F" },
          600: { value: "#554022" },
          700: { value: "#3A2D1A" },
        },
        green: {
          500: { value: "#59C38A" },
          600: { value: "#3F9B6B" },
          700: { value: "#2E7354" },
        },
        neutral: {
          100: { value: "#DCE7EF" },
          200: { value: "#A9BAC8" },
          300: { value: "#778D9F" },
          400: { value: "#526A7D" },
          50: { value: "#F7F9FB" },
          500: { value: "#31495D" },
          600: { value: "#20384B" },
          700: { value: "#142B3C" },
          800: { value: "#0D1F30" },
          900: { value: "#071522" },
          950: { value: "#040B14" },
        },
        red: {
          500: { value: "#E05A67" },
          600: { value: "#B83E50" },
          700: { value: "#8E2E40" },
        },
        yellow: {
          500: { value: "#D8B86A" },
          600: { value: "#B8954D" },
        },
      },
      fontSizes: {
        "2xl": { value: "1.5rem" },
        lg: { value: "1rem" },
        md: { value: "0.875rem" },
        sm: { value: "0.75rem" },
        xl: { value: "1.25rem" },
        xs: { value: "0.6875rem" },
      },
      fonts: {
        body: { value: '"Barlow", sans-serif' },
        heading: { value: '"Cinzel", serif' },
        mono: { value: '"JetBrains Mono", monospace' },
        ui: { value: '"Barlow Semi Condensed", sans-serif' },
      },
      radii: {
        md: { value: "3px" },
        none: { value: "0" },
        sm: { value: "2px" },
      },
      shadows: {
        inset: { value: "inset 0 1px 0 rgba(240, 230, 210, 0.08)" },
        panel: { value: "0 12px 40px rgba(0, 0, 0, 0.36)" },
      },
    },
  },
};

const config = defineConfig(themeConfig);

export const system = createSystem(defaultConfig, config);
