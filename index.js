function _logAndReject(reject, message) {
  "use strict";
  console.log("error: " + message);
  reject(new Error(message));
}

/**
 * The function that undoes the transformation that was needed to convert
 * heatmapdata to uint8s in the python script
 */
function _uint8ToFloat64(value, version) {
  "use strict";
  if (version === 1) {
    return value / 100;
  }
  throw new Error("Only know how to convert version 1");
}

/**
 * Returns an array of Float64Arrays, from a base 64ed jpeg, such as the
 * on returned from the james API
 *
 * The resulting array will contain one Float64Array per floor. A
 * Float64Array is 1 dimensional. To get the value at (x, y), get the value
 * at position [x + y * width].
 *
 * @param {string} heatmap - the base64 heatmap
 * @param {int} nrfloors - the number of floors this heatmap represents
 * @param {int} version - the version of the james API used
 * @returns {Promise for {floors: Float64Array[], width: int, height: int}}
 */
function decodeHeatmap(heatmap, nrfloors, version) {
  "use strict";
  return new Promise(function (resolve, reject) {
    console.assert(typeof heatmap === "string", "heatmap should be a string");
    console.assert(heatmap.search(/^[a-z-A-Z0-9\/+]*={0,2}$/) === 0,
        "heatmap must be base64 encoded, may only contain a-zA-Z0-9/+, " +
        "followed by at most 2 '=' signs");
    console.assert(typeof nrfloors === "number",
        "nrfloors should be a number");
    console.assert(typeof version === "number", "version should be a number");
    console.assert(version === 1, "Only version 1 is supported");
    var img = new Image();
    img.onerror = function () {
      _logAndReject(reject, "problem interpreting heatmap");
    };
    img.onload = function () {
      var heatmapwidth = img.width;
      var heatmapheight = img.height / nrfloors;
      if (heatmapheight % 1 !== 0) {
        _logAndReject(reject, "Problem with nrfloors. Heatmap image has " +
            "height " + img.height + " should be dividable by " + nrfloors);
      }
      var canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      var context = canvas.getContext("2d");
      context.drawImage(img, 0, 0);
      var imagedata = context.getImageData(0, 0, canvas.width, canvas.height);
      var floors = new Array(nrfloors);
      var floornr, pos, value;
      var NRCHANNELS = 4;
      for (floornr = 0; floornr < nrfloors; floornr++) {
        floors[floornr] = new Float64Array(heatmapwidth * heatmapheight);
        for (pos = 0; pos < heatmapwidth * heatmapheight; pos++) {
          value = imagedata.data[
            (pos + heatmapwidth * heatmapheight * floornr) * NRCHANNELS];
          floors[floornr][pos] = _uint8ToFloat64(value, version);
        }
      }
      resolve({floors: floors, width: heatmapwidth, height: heatmapheight});
    };
    img.src = "data:image/jpeg;base64, " + heatmap;
  });
}

windows.module = window.module || {};
module.exports = {decodeHeatmap: decodeHeatmap};
