// Guards the Rules of Hooks and nothing else: a hook after an early return or
// inside a condition passes tsc and vite, then crashes the page in the browser
// (React error 310). Each app's `build` runs this first, so its Docker image
// won't build with such a bug. noInlineConfig stops an eslint-disable comment
// silencing the rule; `--quiet` hides the warning it gives for each such comment.
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["artifacts/{live-app,jahez-live}/src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: { parser: tsParser },
    linterOptions: { noInlineConfig: true },
    plugins: { "react-hooks": reactHooks },
    rules: { "react-hooks/rules-of-hooks": "error" },
  },
];
