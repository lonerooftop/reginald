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
 * @param {string} heatmapurl - url to a heatmap image
 * @param {int} nrfloors - the number of floors this heatmap represents
 * @param {int} version - the version of the james API used
 * @returns {Promise for {floors: Float64Array[], width: int, height: int}}
 */
function decodeHeatmap(heatmapurl, nrfloors, version) {
  "use strict";
  return new Promise(function (resolve, reject) {
    console.assert(typeof heatmapurl === "string",
        "heatmap should be a string");
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
    img.src = heatmapurl;
  });
}

/**
 * Like decodeHeatmap, but takes 2 heatmaps and interpolates between them
 * partInto is a float between 0 and 1 indicating to which extend heatmap
 * 0 should be taken, and to which extend heatmap1
 * @param {string} heatmapurl0 - url to a heatmap image
 * @param {string} heatmapurl1 - url to a heatmap image
 * @param {float} partInto - [0...1] : 0 meaning all hm0, 1 meaning all 1
 * @param {int} nrfloors - the number of floors this heatmap represents
 * @param {int} version - the version of the james API used
 * @returns {Promise for {floors: Float64Array[], width: int, height: int}}
 */
function decodeAndInterpolate(heatmapurl0, heatmapurl1, partInto, nrfloors,
    version) {
  return new Promise(function (resolve, reject) {
    Promise.all([
        decodeHeatmap(heatmapurl0, nrfloors, version),
        decodeHeatmap(heatmapurl1, nrfloors, version)
    ]).then(function (results) {
      var floornr, i;
      var floors = [];
      for (floornr = 0; floornr < nrfloors; floornr++) {
        floors[floornr] = new Float64Array(results[0].floors[floornr]);
        for (i = 0; i < floors[floornr].length; i++) {
          floors[floornr][i] = results[0].floors[floornr][i] +
            partInto * (results[1].floors[floornr][i] -
                results[0].floors[floornr][i]);
        }
      }
      resolve({floors: floors, width: results[0].width,
        height: results[0].height});
    }).catch(function (err) {
      reject(err);
    });
  });
}

if (typeof window !== "undefined") {
  window.module = window.module || {};
}
module.exports = {decodeHeatmap: decodeHeatmap,
  decodeAndInterpolate: decodeAndInterpolate};
