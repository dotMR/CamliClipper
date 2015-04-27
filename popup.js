function onDOMContentLoaded() {
    fetchOptions()
    .then(discoverServer)
    .catch(function(error) {
        return error;
    })
    .then(renderPopup);
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);

/**
 * Retrieve saved 'options' from Chrome storage
 */
function fetchOptions() {
    return new Promise(function(resolve, reject) {
        chrome.storage.sync.get(['url', 'defaultTags'], function(items) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError) // TODO: how to forcibly test this error condition?
            }
            resolve(items);
        });
    });
}

/**
 * Retrieve discovery document from Camlistore blob server
 */
function discoverServer(options) {
    return new Promise(function(resolve, reject) {
        var request = new XMLHttpRequest();
        request.open('GET', options.url);
        request.setRequestHeader("Accept", "text/x-camli-configuration");
        request.onreadystatechange = function() {
            if (request.readyState === 4) {
                if (request.status === 200) {
                    var json = JSON.parse(request.responseText);
                    if (json) {
                        console.log('retrieved camlistore server discovery data from: ' + options.url);
                        var results = {
                            'discovery': json,
                            'options': options
                        };
                        resolve(results);
                    }
                    reject(Error('Error during server discovery'));
                } else {
                    reject(Error(request.responseText));
                }
            }
        }.bind(this);

        request.onerror = function() {
          reject(Error('Network error discovering Camlistore server :('));
        };

        request.send();
    });
}

function renderPopup(results) {
    var content;

    // display caught error
    if (results instanceof Error) {
        content = React.createElement("div", { className: 'error' }, results.message);
    } else {
        content = React.createElement(Popup,
            {
              config: results.options,
              queryString: window.location.search.substring(1),
              serverConnection: new cam.ServerConnection(results.options.url, results.discovery),
            }
        );
    }

    React.render(content, document.getElementById('root'));
}