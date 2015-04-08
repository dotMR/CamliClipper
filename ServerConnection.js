/* 
 * Constructor - no need to invoke directly, call init instead.
 * @constructor
 * @param {String} server_url The URL for the Camlistore server.
 * @param {String} publicKeyRef Your public key blob ref to use for uploads.
 */
function ServerConnection(url, publicKeyRef) {
  this.server_url = url;

  // TODO: query and pull these from discovery doc
  this.public_key_blobref = publicKeyRef;
  this.SIGN_URL = '/sighelper/camli/sig/sign';
  this.UPLOAD_URL = '/bs-recv/camli/upload';
  this.UPLOAD_HELPER_URL = '/ui/?camli.mode=uploadhelper'
};

/*******************************************************************************
 * PUBLIC API METHODS
 ******************************************************************************/

/**
 * Initializes the connection to the server.
 *  NOTE: This MUST be called before making any other requests!
 *
 * @param {Object} config parameters in a JavaScript object.
 *     The following parameters are recognized:
 *         "server_url" {String} The URL for the Camlistore server.
 *         "public_key_blobref" {String} Your public key blob ref to use for uploads.
 * @return {ServerConnection} An initialized ServerConnection object.
 */
ServerConnection.initialize = function(config) {
    window.ServerConnection = new ServerConnection(config.server_url, config.public_key_blobref);
};

/**
 * Request to Camlistore server to sign an object before upload
 *
 * @param {string} blobref blobref of permanode to update.
 * @param {string} What type of claim: "add-attribute", "set-attribute"...
 * @param {string} name of attribute to update.
 * @param {string} value for attribute.
 * @return {Promise} Promise of JSON confirmation.
 */
ServerConnection.prototype.updatePermanodeAttr = function(blobref, claimType, attribute, value) {
  var setAttribute = {
    "camliVersion": 1,
    "camliType": "claim",
    "permaNode": blobref,
    "claimType": claimType,
    "claimDate": dateToRfc3339String(new Date()),
    "attribute": attribute,
    "value": value
  };

  return ServerConnection.signObject(setAttribute).then(ServerConnection.uploadString);
}

/**
 * Submit object to Camlistore server to sign
 *
 * @param {Object} clearObj Unsigned object.
 * @return {Promise} Promise of signed object.
 */
ServerConnection.prototype.signObject = function(clearObj) {

  function sign(clearObj, resolve, reject) {
    clearObj.camliSigner = ServerConnection.public_key_blobref; // TODO: debug scope that prevents me from using 'this'
    var camVersion = clearObj.camliVersion;
    if (camVersion) {
       delete clearObj.camliVersion;
    }
    var clearText = JSON.stringify(clearObj, null, "    ");
    if (camVersion) {
       clearText = "{\"camliVersion\":" + camVersion + ",\n" + clearText.substr("{\n".length);
    }

    var request = new XMLHttpRequest();
    request.open("POST", ServerConnection.server_url + ServerConnection.SIGN_URL); // TODO: debug scope that prevents me from using 'this'
    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    var data = "json=" + encodeURIComponent(clearText);

    request.onreadystatechange = function () {
      if (request.readyState === 4) {
          if (request.status === 200) {
            // this.updateProgress('Object signed'); TODO
            resolve(request.responseText);
          } else {
            reject(Error(request.statusText));
          }
      }
    };

    request.onerror = function() {
      reject(Error('Network error during signing'));
    };

    request.send(data);
  }

  return new Promise(sign.bind(this, clearObj));
};

/**
 * Upload a string to Camlistore server
 *
 * @param {string} s String to upload.
 * @return {Promise} Promise of JSON confirmation.
 */
ServerConnection.prototype.uploadString = function(s) {

  function upload(s, resolve, reject) {
    var byteArray = Crypto.charenc.UTF8.stringToBytes(s);
    var blobref = 'sha1-' + Crypto.SHA1(byteArray);
    var parts = [s];
    var bb = new Blob(parts);
    var fd = new FormData();
    fd.append(blobref, bb);

    var request = new XMLHttpRequest();
    request.open("POST", ServerConnection.server_url + ServerConnection.UPLOAD_URL); // TODO: debug scope that prevents me from using 'this'

    request.onreadystatechange = function () {
      if (request.readyState === 4) {
          if (request.status === 200) {
            var received = JSON.parse(request.responseText).received;
            var ref = received[0].blobRef;
            // this.updateProgress('string uploaded: ' + ref); // TODO move UI logging to status
            resolve(ref);
          } else {
            reject(Error(request.statusText));
          }
      }
    };

    request.onerror = function() {
      reject(Error('Network error uploading string'));
    };

    request.send(fd);
  }

  return new Promise(upload.bind(this, s));
};

/**
 * Upload a blob to Camlistore server
 *
 * @param {blob} Blob to upload.
 * @return {Promise} Promise of JSON confirmation.
 */
ServerConnection.prototype.uploadBlob = function(blob) {

  function upload(blob, resolve, request) {
    var fd = new FormData();
    fd.append("blob", blob, "filename");

    var request = new XMLHttpRequest();
    request.open("POST", ServerConnection.server_url + ServerConnection.UPLOAD_HELPER_URL); // TODO: debug scope that prevents me from using 'this'

    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            if (request.status === 200) {
              var got = JSON.parse(request.responseText).got;
              var fileRef = got[0].fileref
              // this.updateProgress('Blob uploaded: ' + fileRef); //TODO: move to UI
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
  }

  return new Promise(upload.bind(this, blob));
};

/*******************************************************************************
* PRIVATE API METHODS
* Used by the library.  There should be no need to call these methods directly.
*******************************************************************************/
