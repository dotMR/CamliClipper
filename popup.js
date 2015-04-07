/*
  TODO:
    - validate all inputs immediately
    - reduce status messages (just console log?)
    - update layout so status, fields, image fit within one view.
    - introduce React / Flux?
    - rethink how 'results' object is passed through chain.
    - move base connection functions to separate .js object, pull config values from options (already there)
    - default tag from config
    - configurable persistence of related attributes (imgUrl, pageURL, tags) (minimize clicks)
    - default option with no confirmation? ('Add to Camlistore' vs 'Add to Camlistore...')
    - re-read: http://javascriptplayground.com/blog/2015/02/promises/
*/

var publicKeyBlobRef = "TODO";

document.addEventListener('DOMContentLoaded', function() {
  var imgSrc = getUrlParam('imgSrc');
  var pageSrc = getUrlParam('pageSrc');

  var img = document.createElement("img");
  img.src = imgSrc;

  var displayText = document.createTextNode(pageSrc);

  var link = document.createElement("a");
  link.href = pageSrc;
  link.appendChild(displayText);

  var caption = document.createElement("figcaption");
  caption.appendChild(link);

  var figure = document.createElement("figure");
  figure.appendChild(img);
  figure.appendChild(caption);

  document.getElementById('figure-target').appendChild(figure);
  document.getElementById('imageSrc').value = imgSrc;
  document.getElementById('pageSrc').value = pageSrc;

  var form = document.getElementById('uploadForm');
  form.addEventListener('submit', onSubmit, false);
});

// thanks: https://css-tricks.com/snippets/javascript/get-url-variables/
function getUrlParam(variable)
{
   var query = window.location.search.substring(1);
   var vars = query.split("&");
   for (var i=0;i<vars.length;i++) {
           var pair = vars[i].split("=");
           if(pair[0] == variable){return pair[1];}
   }
   return(false);
}

function updateStatusElement(message) {
  var status = document.getElementById("status");
  var text = document.createTextNode(message);

  var item = document.createElement('li');
  item.appendChild(text);
  status.appendChild(item);
}

function updateProgress(message) {
  console.log(message);
  updateStatusElement(message);
}

function resetProgress() {
  var status = document.getElementById("status");
  status.innerHTML = "";
}

function getImageSrc() {
  return document.getElementById('imageSrc').value;
}

function getPageUrl() {
  return document.getElementById('pageSrc').value;
}

function getTags() {
  return document.getElementById('tags').value;
}

function validate() {
  // TODO
  // no fields are required
  // tags field must be a valid list
}

function onSubmit(event) {
  resetProgress();

  validate();

  uploadImage(fetchImage(getImageSrc()))
  .then(createPermanode)
  .then(addCamliContentRef)
  .then(addRelatedAttributes)
  .catch(function(error) {
    console.log("Found error: ", error);
    updateProgress(error);
  });

  event.preventDefault();
}

function uploadImage(fetchDataPromise) {
  return fetchDataPromise
    .then(checkForDuplicate)
    .then(doUpload);
}

function fetchImage(url) {
  updateProgress('Fetching image');
  return getAsBlob(url)
    .then(captureBlobAndComputeRef)
    .then(assembleResults);
}

function captureBlobAndComputeRef(blob) {
  var resolvedBlob = Promise.resolve(blob);
  var blobref = convertToTypedArray(blob).then(generateHash);

  return Promise.all([resolvedBlob, blobref]);
}

function convertToTypedArray(blob) {
  return new Promise(function(resolve, reject) {
    var reader  = new FileReader();

    reader.onload = function() {
      if (reader.readyState === 2) {
        this.updateProgress('Blob converted to byte array');
        resolve(reader.result);
      }
    }.bind(this);

    reader.onerror = function() {
      reject(Error('There was an error converting to typed array'));
    }

    reader.readAsArrayBuffer(blob);
  });
}

function generateHash(arrayBuffer) {
  var bytes = new Uint8Array(arrayBuffer);
  var blobref = 'sha1-' + Crypto.SHA1(bytes);
  updateProgress('Hash computed from byte array: ' + blobref);
  return blobref;
}

// 'readable=ify' the results
function assembleResults(results) {
  return {
    'blob': results[0],
    'blobref': results[1]
  };
}

function checkForDuplicate(results) {
  return new Promise(function(resolve, reject) {
    var url = 'http://localhost:3179/my-search/camli/search/files?' + 'wholedigest=' + results.blobref;
    var request = new XMLHttpRequest();
    request.open('GET', url);

    request.onreadystatechange = function() {
      if (request.readyState === 4) {
          if (request.status === 200) {
            var json = JSON.parse(request.responseText);
            if (json.files) {
              if (json.files.length == 0) {
                this.updateProgress('Image does not already exist');
                resolve(results);
              } else {
                reject(Error('Image already uploaded'));
              }
            }
          }
      }
    }.bind(this);

    request.onerror = function() {
      reject(Error('Network error'));
    };

    request.send();
  });
}

function doUpload(results) {
  updateProgress('Uploading image');
  return uploadBlob(results.blob).then(
    function(ref) {
      // capture fileRef returned from upload
      results.fileref = ref;
      return results;
    });
}

function createPermanode(results) {
  updateProgress('Creating permanode');

  var permanode = {
    "camliVersion": 1,
    "camliType": "permanode",
    "random": "" + Math.random()
  };

  return signObject(permanode).then(uploadString).then(
    function(data) {
      results.permanoderef = data
      return results;
  });
}

function addCamliContentRef(results) {
  updateProgress('Adding camliContent');
  return updatePermanodeAttr(results.permanoderef, "set-attribute", "camliContent", results.fileref).then(
    function(data) {
      return results;
    });
}

function addRelatedAttributes(results) {

  var imgSrc = updatePermanodeAttr(results.permanoderef, "set-attribute", "imgSrc", getImageSrc());
  var pageSrc = updatePermanodeAttr(results.permanoderef, "set-attribute", "found", getPageUrl());
  var promises = [imgSrc, pageSrc];

  var tags = getTags().split(',').map(function(s) { return s.trim(); });
  if (tags.some(function(t) { return !t })) {
    // TODO: Should validate fields first and reject immediately
    console.log('Tag validation error!')
  } else {
    tags.forEach(function(tag) {
      promises.push(updatePermanodeAttr(results.permanoderef, "add-attribute", "tag", tag));
    })
  }

  return Promise.all(promises).then(
    function(data) {
      return results;
    });
}

// Format |dateVal| as specified by RFC 3339.
function dateToRfc3339String(dateVal) {
  // Return a string containing |num| zero-padded to |length| digits.
  var pad = function(num, length) {
    var numStr = "" + num;
    while (numStr.length < length) {
      numStr = "0" + numStr;
    }
    return numStr;
  };

  // thanks: http://stackoverflow.com/questions/7975005/format-a-string-using-placeholders-and-an-object-of-substitutions
  var subs = {
    "%UTC_YEAR%":     dateVal.getUTCFullYear(),
    "%UTC_MONTH%":    pad(dateVal.getUTCMonth() + 1, 2),
    "%UTC_DATE%":     pad(dateVal.getUTCDate(), 2),
    "%UTC_HOURS%":    pad(dateVal.getUTCHours(), 2),
    "%UTC_MINS%":     pad(dateVal.getUTCMinutes(), 2),
    "%UTC_SECONDS%":  pad(dateVal.getUTCSeconds(), 2),
  };

  var formatted = "%UTC_YEAR%-%UTC_MONTH%-%UTC_DATE%T%UTC_HOURS%:%UTC_MINS%:%UTC_SECONDS%Z";

  formatted = formatted.replace(/%\w+%/g, function(all) {
     return subs[all] || all;
  });

  return formatted;
};

// --------------- CONNECTION FUNCTIONS --------------- //

// @param {string} blobref blobref of permanode to update.
// @param {string} What type of claim: "add-attribute", "set-attribute"...
// @param {string} name of attribute to update.
// @param {string} value for attribute.
function updatePermanodeAttr(blobref, claimType, attribute, value) {
  var setAttribute = {
    "camliVersion": 1,
    "camliType": "claim",
    "permaNode": blobref,
    "claimType": claimType,
    "claimDate": dateToRfc3339String(new Date()),
    "attribute": attribute,
    "value": value
  };

  return signObject(setAttribute).then(uploadString);
}

// @param {string} url of item to download as blob.
function getAsBlob(url) {
  return new Promise(function(resolve, reject) {
    var request = new XMLHttpRequest();
    request.open('GET', url);
    request.responseType = 'blob';

    request.onload = function() {
      if (request.status === 200) {
        this.updateProgress('Blob loaded');
        resolve(request.response);
      } else {
        reject(Error('Blob didn\'t load successfully; error:' + request.statusText));
      }
    }.bind(this);

    request.onerror = function() {
      reject(Error('There was a network error loading the blob'));
    };

    request.send();
  });
}

// @param {blob} blob to upload
function uploadBlob(blob) {
  return new Promise(function(resolve, reject) {
    var fd = new FormData();
    fd.append("blob", blob, "filename");

    var request = new XMLHttpRequest();
    request.open("POST", "http://localhost:3179/ui/?camli.mode=uploadhelper");

    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            if (request.status === 200) {
              var got = JSON.parse(request.responseText).got;
              var fileRef = got[0].fileref
              this.updateProgress('Blob uploaded: ' + fileRef);
              resolve(fileRef);
            } else {
              reject(Error(request.statusText));
            }
        }
    }.bind(this);

    request.onerror = function() {
      reject(Error('Network error'));
    };

    request.send(fd);
  });
}

// @param {Object} clearObj Unsigned object.
function signObject(clearObj) {
  return new Promise(function(resolve, reject) {
    clearObj.camliSigner = publicKeyBlobRef;
    var camVersion = clearObj.camliVersion;
    if (camVersion) {
       delete clearObj.camliVersion;
    }
    var clearText = JSON.stringify(clearObj, null, "    ");
    if (camVersion) {
       clearText = "{\"camliVersion\":" + camVersion + ",\n" + clearText.substr("{\n".length);
    }

    var request = new XMLHttpRequest();
    request.open("POST", "http://localhost:3179/sighelper/camli/sig/sign");
    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    var data = "json=" + encodeURIComponent(clearText);

    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            if (request.status === 200) {
              this.updateProgress('Object signed');
              resolve(request.responseText);
            } else {
              reject(Error(request.statusText));
            }
        }
    }.bind(this);

    request.onerror = function() {
      reject(Error('Network error during signing'));
    };

    request.send(data);
  });
}

// @param {string} s String to upload.
function uploadString(s) {
  return new Promise(function(resolve, reject) {
    // var hash = cam.blob.createHash();
    // hash.update(goog.crypt.stringToUtf8ByteArray(str));
    // var blobref = 'sha1-' + goog.crypt.byteArrayToHex(hash.digest());

    var byteArray = Crypto.charenc.UTF8.stringToBytes(s);
    // var uintbytes = new Uint8Array(byteArray);

    var blobref = 'sha1-' + Crypto.SHA1(byteArray);
    var parts = [s];
    var bb = new Blob(parts);
    var fd = new FormData();
    fd.append(blobref, bb);

    var request = new XMLHttpRequest();
    request.open("POST", "http://localhost:3179/bs-recv/camli/upload");

    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            if (request.status === 200) {
              var received = JSON.parse(request.responseText).received;
              var ref = received[0].blobRef;
              this.updateProgress('string uploaded: ' + ref);
              resolve(ref);
            } else {
              reject(Error(request.statusText));
            }
        }
    }.bind(this);

    request.onerror = function() {
      reject(Error('Network error uploading string'));
    };

    request.send(fd);
  });
}
