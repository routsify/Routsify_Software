import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  { ignores: [".next/**", "node_modules/**", "out/**", "coverage/**", "next-env.d.ts"] },
];

export default config;
