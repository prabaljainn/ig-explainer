import { Config } from "@remotion/cli/config";

Config.setOverwriteOutput(true);
// PNG frames, not JPEG: the content is flat colour on true black, and JPEG puts ringing on every crisp edge
// which the h264 pass then has to spend bits encoding. Measured on database-index: same render time, 18%
// smaller file. bt709/limited is what a delivery file should say it is; an untagged one is a gamble on the
// platform's transcoder.
Config.setVideoImageFormat("png");
Config.setColorSpace("bt709");
