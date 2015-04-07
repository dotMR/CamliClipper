// Saves options to chrome.storage
function save_options() {
  var publicKey = document.getElementById('publicKey').value;
  var serverUrl = document.getElementById('serverUrl').value;
  var tags = document.getElementById('tags').value;

  // TODO: validate storage of values!

  chrome.storage.sync.set({
    publicKey: publicKey,
    serverUrl: serverUrl,
    tags: tags
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

// Restores using the preferences stored in chrome.storage
function restore_options() {

  // Set default values
  chrome.storage.sync.get({
    publicKey: '',
    serverUrl: 'http://localhost:3179',
    tags: 'clipper'
  }, function(items) {
    document.getElementById('publicKey').value = items.publicKey;
    document.getElementById('serverUrl').value = items.serverUrl;
    document.getElementById('tags').value = items.tags;
  });
}

document.addEventListener('DOMContentLoaded', restore_options);

document.getElementById('save').addEventListener('click',
    save_options);