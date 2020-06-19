const path = require("path");

module.exports = function customMappingFunction(
  explicit,
  implicit,
  filePath,
  reflection,
  context
) {
  console.log("File name: " + path.basename(filePath));
  return path.basename(filePath).replace(".ts", "");
};
