# CamliClipper
Chrome extension for clipping web images and sending to [Camlistore](www.camlistore.org).

In addition to basic image upload, you can provide additional metadata for the image's permanode such as:
- Source URL of the image
- URL of the page where you found the image
- Tags to apply to the image

##Notes
- WIP: This is a work-in-progress. [Status](https://github.com/dotMR/CamliClipper/issues)
- I've tried to conform to the full camlistore sign/upload process. But if I missed something, let me know.
- Currently only supports localhost no-auth (no Basic userpass AUTH)

##Installation
- After cloning the repository, follow the directions [here](https://developer.chrome.com/extensions/getstarted#unpacked) to install the extension
- Once installed, provide the camlistore server url and any default tags you would like applied via the extension's options.

![Options](/doc/options.png)

##Usage
- While browsing, right-click on an image and select 'Save to Camlistore' from the context menu to launch the submission form

![Save to Camlistore](/doc/save-to-camlistore.png)




