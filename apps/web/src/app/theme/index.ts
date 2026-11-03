import { createSystem, defaultConfig, defineConfig, defineRecipe } from "@chakra-ui/react";

const buttonRecipeOptions = {
  base: {
    _active: {
      transform: "translateY(1px)",
    },
    borderRadius: "none",
    borderWidth: "1px",
    boxShadow: "inset",
    fontFamily: "ui",
    fontWeight: "700",
    letterSpacing: "wide",
    minH: "10",
    textTransform: "uppercase",
    transition: "background 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out",
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
        px: "5",
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
          color: "brand.solid",
        },
        bg: "transparent",
        borderColor: "transparent",
        boxShadow: "none",
        color: "fg.muted",
      },
      outline: {
        _hover: {
          bg: "surface.raised",
          borderColor: "brand.solid",
          color: "brand.emphasized",
        },
        bg: "surface.sunken",
        borderColor: "border.default",
        color: "fg.default",
      },
      solid: {
        _hover: {
          bg: "brand.emphasized",
          borderColor: "brand.emphasized",
        },
        bg: "brand.solid",
        borderColor: "brand.emphasized",
        color: "brand.contrast",
      },
    },
  },
} as const;

const inputRecipeOptions = {
  base: {
    _focusVisible: {
      borderColor: "accent.solid",
      boxShadow: "0 0 0 1px var(--chakra-colors-accent-solid), inset",
    },
    _placeholder: {
      color: "fg.subtle",
    },
    bg: "surface.sunken",
    borderColor: "border.default",
    borderRadius: "none",
    color: "fg.default",
    fontFamily: "body",
    minH: "12",
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
        "border.default": { value: "{colors.neutral.400}" },
        "border.emphasized": { value: "{colors.brand.600}" },
        "brand.contrast": { value: "{colors.neutral.950}" },
        "brand.emphasized": { value: "{colors.brand.300}" },
        "brand.solid": { value: "{colors.brand.500}" },
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
          400: { value: "#8eb6ce" },
          500: { value: "#4d82a4" },
          600: { value: "#315b77" },
          700: { value: "#203e54" },
        },
        brand: {
          100: { value: "#f5dda0" },
          200: { value: "#e3bb59" },
          300: { value: "#c8912e" },
          400: { value: "#9e681d" },
          50: { value: "#fff6d8" },
          500: { value: "#b77a24" },
          600: { value: "#754a18" },
          700: { value: "#432910" },
        },
        green: {
          500: { value: "#7c9e45" },
          600: { value: "#56752e" },
          700: { value: "#354c21" },
        },
        neutral: {
          100: { value: "#d8d0bd" },
          200: { value: "#aaa38f" },
          300: { value: "#7c7768" },
          400: { value: "#56544d" },
          50: { value: "#f1ead9" },
          500: { value: "#3b3b38" },
          600: { value: "#2c2e2d" },
          700: { value: "#202323" },
          800: { value: "#171a1a" },
          900: { value: "#0f1212" },
          950: { value: "#090b0b" },
        },
        red: {
          500: { value: "#c95843" },
          600: { value: "#963c30" },
          700: { value: "#65271f" },
        },
        yellow: {
          500: { value: "#d7b347" },
          600: { value: "#9f7d24" },
        },
      },
      fontSizes: {
        "2xl": { value: "1.5rem" },
        "3xl": { value: "1.875rem" },
        "4xl": { value: "2.25rem" },
        lg: { value: "1rem" },
        md: { value: "0.875rem" },
        sm: { value: "0.75rem" },
        xl: { value: "1.25rem" },
        xs: { value: "0.6875rem" },
      },
      fonts: {
        body: { value: '"Roboto Condensed", "Barlow", sans-serif' },
        heading: { value: '"Bree Serif", "Cinzel", serif' },
        mono: { value: '"JetBrains Mono", monospace' },
        ui: { value: '"Roboto Condensed", "Barlow Semi Condensed", sans-serif' },
      },
      radii: {
        md: { value: "2px" },
        none: { value: "0" },
        sm: { value: "1px" },
      },
      shadows: {
        inset: { value: "inset 0 1px 0 rgba(241, 234, 217, 0.12)" },
        panel: {
          value: "0 12px 28px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(241, 234, 217, 0.05)",
        },
      },
    },
  },
};

const config = defineConfig(themeConfig);

export const system = createSystem(defaultConfig, config);
