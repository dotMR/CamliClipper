/*
  TODO:
    - Support storage of base64-encoded images (like in google image search results)
    - Support basic username/password auth
        - review storage of sensitive information
    - introduce Flux concepts to app functionality? (look at reflux or Marty)

    - how to adjust size of popup dynamically? Seems like I have to set the size in background.js
    - show Loading message / spinner while image is loading

  ENHANCEMENTS:
    - update ServerConnection.js @return doc params (promise of what...)
    - Review JS includes (can any be async / defered)?  https://developers.google.com/speed/docs/insights/BlockingJS
    - Start to think of this in terms of possible metadata to provide
        - Maybe the options view is a table where you can enter custom metadata, or choose from pre-selected list
    - Configurable persistence of related attributes?
        - in options you select the defaults you want (only save pageURl, always add this tag)
        - add another express option to the menu ('Add to Camlistore' vs 'Add to Camlistore...') which just uses defaults (minimize clicks)
*/

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);

function onDOMContentLoaded() {
    fetchOptions()
    .then(discoverServer)
    .catch(function(error) {
        return error;
    })
    .then(renderPopup);
}

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