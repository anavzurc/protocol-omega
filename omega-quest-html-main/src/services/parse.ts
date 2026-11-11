import ParseSDK from "parse/dist/parse.min.js";

const Parse = (ParseSDK as any).Parse || ParseSDK;

Parse.initialize(
  import.meta.env.VITE_PARSE_APP_ID,
  import.meta.env.VITE_PARSE_JS_KEY
);

Parse.serverURL =
  import.meta.env.VITE_PARSE_SERVER_URL;

export default Parse;