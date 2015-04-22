/*
  TODO:
    - validate all refs logged to console (missing any?)
    - update layout so status, fields, image fit within one view
    - improve error validation (indicate problem at field, differentiate color)
    - set status from popup page (when loading options), or move this to main component as well?_
    - introduce Flux concepts to app functionality
    - move ServerConnection init into ServerConnection (pass a URL?)

  ENHANCEMENTS:
    - Support storage of base64-encoded images (like in google image search results)
    - Review JS includes (can any be async / defered)?  https://developers.google.com/speed/docs/insights/BlockingJS
    - Support basic username/password auth
        - review storage of sensitive information
    - Start to think of this in terms of possible metadata to provide
        - Maybe the options view is a table where you can enter custom metadata, or choose from pre-selected list
    - Configurable persistence of related attributes?
        - in options you select the defaults you want (only save pageURl, always add this tag)
        - add another express option to the menu ('Add to Camlistore' vs 'Add to Camlistore...') which just uses defaults (minimize clicks)
*/

function onDOMContentLoaded() {
  fetchOptions()
  .then(discoverServer)
  .then(initializePageElements)
  .catch(function(error) {
    alert(error.message);
    // setStatus(error.message); // TODO: how to set error message - move to lower level?
  });
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);

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
 * Retrieve discovery document from Camlistore blob server
 * @param {JSON} 'options' persisted values from chrome storage
 *    required: options.url
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
                'options': options,
                'url': options.url
              };
              resolve(results);
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
 * @param {JSON} 'results' bundled data from discovery process
 *    required: discovery (doc from camlistore server)
 *              options   (persisted options)
 */
function initializePageElements(results) {

  React.render(
      React.createElement(Popup,
        {
          imgSrc: getUrlParam('imgSrc'),
          pageSrc: getUrlParam('pageSrc'),
          statusMessage: 'Status',
          serverConnection: new cam.ServerConnection(results.url, results.discovery),
          tags: results.options.defaultTags
        }),
      document.getElementById('root')
  );

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