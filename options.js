function getUrlNode() {
  return document.getElementById('serverUrl');
}

function getTagsNode() {
  return document.getElementById('defaultTags');
}

function getStatusNode() {
  return document.getElementById('status');
}

function getSaveNode() {
  return document.getElementById('save');
}

function updateStatus(status) {
  getStatusNode().textContent = status;
}

function resetStatus() {
  updateStatus('');
}

function save_options() {
  chrome.storage.sync.set({
    serverUrl: getUrlNode().value,
    defaultTags: getTagsNode().value
  }, function() {
    if (chrome.runtime.error) {
      updateStatus("Error saving options");
    } else {
      updateStatus('Options saved!');
      setTimeout(function() {resetStatus();}, 1000);
    }
  });
}

function restore_options() {
  // Set default values
  chrome.storage.sync.get({
    serverUrl: 'http://localhost:3179',
    defaultTags: 'clipper'
  }, function(items) {
    if (!chrome.runtime.error) {
      getUrlNode().value = items.serverUrl;
      getTagsNode().value = items.defaultTags;
    } else {
      updateStatus('Error retrieving options')
    }
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
getSaveNode().addEventListener('click', save_options);
