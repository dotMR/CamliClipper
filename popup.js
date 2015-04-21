/*
  TODO:
    - review progress messages, add missing from server connection, remove others
    - update layout so status, fields, image fit within one view - introduce React / Flux?
    - add ability to save base64 encoded images (google search results)
    - introduce username/password auth (review persistence of these values as well)
    - configurable persistence of related attributes (imgUrl, pageURL, tags) (minimize clicks)
    - default option with no confirmation? ('Add to Camlistore' vs 'Add to Camlistore...')
*/

var sc;

document.addEventListener('DOMContentLoaded', function() {
  fetchOptions()
  .then(initializeServerConnection)
  .then(initializePageElements)
  .catch(function(error) {
    updateProgress("Error initializing component: ", error);
  });
});

/**
 * Retrieve saved 'options' from chrome storage
 * @return {JSON} persisted values. The following parameters are currently used:
 *      url:          URL of Camlistore server
 *      defaultTags:  Default tag values for input form
 */
function fetchOptions() {
  return new Promise(function(resolve, reject) {
    chrome.storage.sync.get(null, function(items) {
      if (chrome.runtime.lastError) {
        reject(Error('error retrieving config from storage')); // TODO: how to test???
      }
      resolve(items);
    });
  });
}

/**
 * Initialize connection to Camlistore blob server
 * @param {JSON} 'options' persisted values from chrome storage
 *    required: options.url
 */
function initializeServerConnection(options) {
  return new Promise(function(resolve, reject) {
    var request = new XMLHttpRequest();
    request.open('GET', options.url);
    request.setRequestHeader("Accept", "text/x-camli-configuration");

    request.onreadystatechange = function() {
      if (request.readyState === 4) {
          if (request.status === 200) {
            var json = JSON.parse(request.responseText);
            if (json) {
              sc = new cam.ServerConnection(options.url, json);
              resolve(options);
            }
            reject(Error('Invalid server discovery data'))
          }
      }
    }.bind(this);

    request.onerror = function() {
      reject(Error('Network error discovering server'));
    };

    request.send();
  });
}

/**
 * Initialize page elements
 * @param {JSON} 'options' persisted values from chrome storage
 *    required: options.defaultTags
 */
function initializePageElements(options) {
  var form = document.getElementById('uploadForm');
  form.addEventListener('submit', onSubmit, false);

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
  document.getElementById('tags').value = options.defaultTags;

  return Promise.resolve('Page initialized');
}

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
  var tagsAsString = document.getElementById('tags').value;
  var tags = tagsAsString.split(',').map(function(s) { return s.trim(); });
  return tags;
}

function onSubmit(event) {
  resetProgress();

  var error = validateForm();
  if(!error) {
    uploadImage(fetchImage(getImageSrc()))
    .then(createPermanode)
    .then(addCamliContentRef)
    .then(addImageSrcAttribute)
    .then(addPageSrcAttribute)
    .then(addTags)
    .catch(function(error) {
      console.log("Found error: ", error);
      updateProgress(error);
    });
  } else {
    updateProgress(error);
  }

  event.preventDefault();
}

function validateForm() {
  // validate imageSource
  var encoded = getImageSrc().startsWith('data:');
  if (encoded) {
    return 'Encoded images are not currently supported';
  }

  // validate tags
  var tags = document.getElementById('tags').value;
  if (tags) {
    var arTags = tags.split(',').map(function(s) { return s.trim(); });
    var invalid = arTags.some(function(t) { return !t });

    if (invalid) {
      return 'At least one invalid tag was supplied';
    }
  }

  return '';
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
  updateProgress('Checking for duplicate');
  return sc.findExisting(results.blobref).then(
    function(json) {
      return results;
    });
}

function doUpload(results) {
  updateProgress('Uploading image');
  return sc.uploadBlob(results.blob).then(
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

  return sc.signObject(permanode)
  .then(sc.uploadString.bind(sc))
  .then(
    function(data) {
      results.permanoderef = data
      return results;
  });
}

function addCamliContentRef(results) {
  updateProgress('Adding camliContent');
  return sc.updatePermanodeAttr(results.permanoderef, "set-attribute", "camliContent", results.fileref).then(
    function(data) {
      return results;
    });
}

function addImageSrcAttribute(results) {
  updateProgress('Adding imageSrc');
  return sc.updatePermanodeAttr(results.permanoderef, "set-attribute", "imgSrc", getImageSrc()).then(
    function(data) {
      return results;
    });
}

function addPageSrcAttribute(results) {
  updateProgress('Adding pageSrc');
  return sc.updatePermanodeAttr(results.permanoderef, "set-attribute", "foundAt", getPageUrl()).then(
    function(data) {
      return results;
    });
}

function addTags(results) {
  updateProgress('Adding tags');
  this.getTags().forEach(function(tag) {
    if (tag) {
      sc.updatePermanodeAttr(results.permanoderef, "add-attribute", "tag", tag)
    }
  })
}

/**
 * Request to load a url as a 'blob'
 *
 * @param {string} url of item to download as blob.
 * @return {Promise} Promise of blob data.
 */
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