/*
  TODO:
    - validate all refs logged to console (missing any?)
    - update layout so status, fields, image fit within one view - introduce React / Flux?

  ENHANCEMENTS:
    - Support storage of base64-encoded images (like in google image search results)
    - Support basic username/password auth
        - review storage of sensitive information with this
    - Configurable persistence of related attributes?
        - in options you save the defaults you want (only save pageURl, and always add this)
        - add another express option to the menu ('Add to Camlistore' vs 'Add to Camlistore...') which just uses defaults (minimize clicks)
*/

var sc;

document.addEventListener('DOMContentLoaded', function() {
  fetchOptions()
  .then(initializeServerConnection)
  .then(initializePageElements)
  .catch(function(error) {
    setStatus("Error initializing component: ", error);
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
    chrome.storage.sync.get(['url', 'defaultTags'], function(items) {
      if (chrome.runtime.lastError) {
        reject(Error('error retrieving config from storage')); // TODO: how to test error condition
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
              console.log('initializing connection to: ' + options.url);
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

function setStatus(message) {
  var status = document.getElementById("status");
  status.textContent = message;
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
    .then(onFinish)
    .catch(function(error) {
      console.log("Found error: ", error);
      setStatus(error);
    });
  } else {
    setStatus(error);
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
  console.log('fetching image from: ' + url);
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
        console.log('blob converted to typed array');
        resolve(reader.result);
      }
    }.bind(this);

    reader.onerror = function() {
      reject(Error('There was an error converting the image blob to a typed array'));
    }

    reader.readAsArrayBuffer(blob);
  });
}

function generateHash(arrayBuffer) {
  var bytes = new Uint8Array(arrayBuffer);
  var blobref = 'sha1-' + Crypto.SHA1(bytes);
  console.log('hash computed: ' + blobref);
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
  console.log('checking for duplicates');
  return sc.findExisting(results.blobref).then(
    function(json) {
      return results;
    });
}

function doUpload(results) {
  return sc.uploadBlob(results.blob).then(
    function(ref) {
      // capture fileRef returned from upload
      console.log('blob uploaded: ' + ref);
      results.fileref = ref;
      return results;
    });
}

function createPermanode(results) {
  var permanode = {
    "camliVersion": 1,
    "camliType": "permanode",
    "random": "" + Math.random()
  };

  return sc.signObject(permanode)
  .then(sc.uploadString.bind(sc))
  .then(
    function(data) {
      console.log('permanode created: ' + data);
      results.permanoderef = data
      return results;
  });
}

function addCamliContentRef(results) {
  return sc.updatePermanodeAttr(results.permanoderef, "set-attribute", "camliContent", results.fileref).then(
    function(data) {
      console.log('camliContent attribute added: ' + data);
      return results;
    });
}

function addImageSrcAttribute(results) {
  return sc.updatePermanodeAttr(results.permanoderef, "set-attribute", "imgSrc", getImageSrc()).then(
    function(data) {
      console.log('imgSrc attribute added: ' + data);
      return results;
    });
}

function addPageSrcAttribute(results) {
  return sc.updatePermanodeAttr(results.permanoderef, "set-attribute", "foundAt", getPageUrl()).then(
    function(data) {
      console.log('foundAt attribute added: ' + data);
      return results;
    });
}

function addTags(results) {
  var promises = [];
  this.getTags().forEach(function(tag) {
    if (tag) {
      promises.push(sc.updatePermanodeAttr(results.permanoderef, "add-attribute", "tag", tag));
    }
  });

  return Promise.all(promises).then(function(results) {
    results.forEach(function(ref) {
      console.log('tag attributed added: ' + ref);
    });
    return results;
  });
}

function onFinish() {
  setStatus('Success!');
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