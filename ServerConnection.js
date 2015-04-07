(function(){

var ServerConnection = {};

// cam.ServerConnection = function(config) {
// 	this.config_ = config;
// }

ServerConnection.PUBLIC_KEY_BLOBREF = "sha1-f2b0b7da718b97ce8c31591d8ed4645c777f3ef4";

// cam.ServerConnection.prototype.getConfig = function() {
// 	return this.config_;
// };

// @param {Object} clearObj Unsigned object.
ServerConnection.sign = function(clearObj) {
  return new Promise(function(resolve, reject) {
    clearObj.camliSigner = this.PUBLIC_KEY_BLOBREF;
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

})();